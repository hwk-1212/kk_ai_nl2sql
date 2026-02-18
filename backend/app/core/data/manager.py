"""数据管理核心服务 — 负责数据源 CRUD、文件解析调度、表注册到 user_data schema。

上传流程:
  1. 保存文件到 MinIO (备份)
  2. 保存为临时文件
  3. 调用 FileParser 解析
  4. 创建 DataSource 记录
  5. 对每个 ParsedTable: CREATE TABLE + BULK INSERT + 创建 DataTable 记录
  6. 更新 DataSource 状态为 ready
"""
from __future__ import annotations

import asyncio
import io
import logging
import re
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from minio import Minio
from sqlalchemy import select, func, text as sa_text, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.config import get_settings
from app.core.data.parsers import (
    FileParser, ParseResult, ParsedTable, ColumnInfo,
    PG_TYPE_MAP, sanitize_table_name, coerce_value,
)
from app.models.data_source import DataSource
from app.models.data_table import DataTable

logger = logging.getLogger(__name__)
settings = get_settings()

BATCH_SIZE = 500


def _uid8(uid: uuid.UUID) -> str:
    return str(uid).replace("-", "")[:8]


def _get_user_schema(tenant_id: uuid.UUID | None) -> str:
    if tenant_id:
        return f"ud_tenant_{_uid8(tenant_id)}"
    return "user_data"


def _get_pg_table_name(user_id: uuid.UUID, table_name: str) -> str:
    return f"ud_{_uid8(user_id)}_{table_name}"


def _pg_identifier(name: str) -> str:
    """双引号包裹 PG 标识符，防注入。"""
    return '"' + name.replace('"', '""') + '"'


class DataManager:
    """协调文件解析、user_data schema 写入、DataSource / DataTable 持久化。"""

    def __init__(self, engine, minio_client: Minio | None = None):
        self.engine = engine
        self.minio = minio_client
        self.parser = FileParser()

    # ===================== Upload & Parse =====================

    async def upload_and_parse(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID | None,
        filename: str,
        content: bytes,
    ) -> DataSource:
        """完整上传流程: 解析 → 建表 → 导入 → MinIO 备份。"""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        allowed = set(settings.allowed_upload_types.split(","))
        if ext not in allowed:
            raise ValueError(f"Unsupported file type: {ext}. Allowed: {allowed}")

        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if len(content) > max_bytes:
            raise ValueError(f"File too large: {len(content)} bytes (max {settings.max_upload_size_mb} MB)")

        source_name = Path(filename).stem
        ds = DataSource(
            user_id=user_id,
            tenant_id=tenant_id,
            name=source_name,
            source_type="upload",
            file_name=filename,
            file_size=len(content),
            file_type=ext,
            status="parsing",
        )
        db.add(ds)
        await db.commit()
        await db.refresh(ds)

        try:
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            parse_result = await self.parser.parse(tmp_path, ext, original_name=filename)

            if not parse_result.tables:
                ds.status = "error"
                ds.error_message = "No data found in file"
                await db.commit()
                return ds

            schema_name = _get_user_schema(tenant_id)
            await self._ensure_schema(schema_name)

            table_count = 0
            for pt in parse_result.tables:
                pg_table = _get_pg_table_name(user_id, pt.name)
                await self._create_pg_table(schema_name, pg_table, pt.columns)
                await self._insert_data(schema_name, pg_table, pt.columns, pt.data)

                cols_meta = [
                    {"name": c.name, "type": c.type, "nullable": c.nullable, "comment": c.comment}
                    for c in pt.columns
                ]
                dt = DataTable(
                    data_source_id=ds.id,
                    user_id=user_id,
                    tenant_id=tenant_id,
                    name=pt.name,
                    display_name=pt.name,
                    pg_schema=schema_name,
                    pg_table_name=pg_table,
                    column_count=len(pt.columns),
                    row_count=pt.row_count,
                    columns_meta=cols_meta,
                )
                db.add(dt)
                table_count += 1

            ds.status = "ready"
            ds.table_count = table_count
            await db.commit()

            # MinIO backup (best-effort, async)
            asyncio.create_task(self._backup_to_minio(user_id, ds.id, filename, content))

        except Exception as e:
            logger.exception("Upload parse failed: %s", e)
            ds.status = "error"
            ds.error_message = str(e)[:2000]
            await db.commit()

        finally:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass

        await db.refresh(ds)
        return ds

    # ===================== Schema management =====================

    async def _ensure_schema(self, schema_name: str) -> None:
        safe = _pg_identifier(schema_name)
        async with self.engine.begin() as conn:
            await conn.execute(sa_text(f"CREATE SCHEMA IF NOT EXISTS {safe}"))
            await conn.execute(sa_text(
                f"GRANT ALL ON SCHEMA {safe} TO {_pg_identifier(settings.postgres_user)}"
            ))

    # ===================== Table DDL =====================

    async def _create_pg_table(
        self, schema: str, table_name: str, columns: list[ColumnInfo]
    ) -> None:
        col_defs = []
        for c in columns:
            pg_type = PG_TYPE_MAP.get(c.type, "TEXT")
            null_clause = "" if c.nullable else " NOT NULL"
            col_defs.append(f"  {_pg_identifier(c.name)} {pg_type}{null_clause}")

        ddl = (
            f"CREATE TABLE IF NOT EXISTS {_pg_identifier(schema)}.{_pg_identifier(table_name)} (\n"
            + ",\n".join(col_defs)
            + "\n)"
        )
        async with self.engine.begin() as conn:
            await conn.execute(sa_text(ddl))

    async def _insert_data(
        self, schema: str, table_name: str, columns: list[ColumnInfo], data: list[dict]
    ) -> None:
        if not data:
            return

        col_names = [c.name for c in columns]
        col_types = [c.type for c in columns]
        qualified = f"{_pg_identifier(schema)}.{_pg_identifier(table_name)}"
        placeholders = ", ".join(f":c{i}" for i in range(len(col_names)))
        col_list = ", ".join(_pg_identifier(c) for c in col_names)
        insert_sql = f"INSERT INTO {qualified} ({col_list}) VALUES ({placeholders})"

        for batch_start in range(0, len(data), BATCH_SIZE):
            batch = data[batch_start:batch_start + BATCH_SIZE]
            params_list = []
            for row in batch:
                params = {}
                for i, col_name in enumerate(col_names):
                    val = row.get(col_name)
                    params[f"c{i}"] = coerce_value(val, col_types[i])
                params_list.append(params)

            async with self.engine.begin() as conn:
                for params in params_list:
                    await conn.execute(sa_text(insert_sql), params)

    async def drop_pg_table(self, schema: str, table_name: str) -> None:
        ddl = f"DROP TABLE IF EXISTS {_pg_identifier(schema)}.{_pg_identifier(table_name)} CASCADE"
        async with self.engine.begin() as conn:
            await conn.execute(sa_text(ddl))

    # ===================== CRUD helpers =====================

    async def list_sources(
        self, db: AsyncSession, user_id: uuid.UUID, offset: int = 0, limit: int = 50
    ) -> tuple[list[DataSource], int]:
        count_q = select(func.count()).select_from(DataSource).where(DataSource.user_id == user_id)
        total = (await db.execute(count_q)).scalar() or 0

        q = (
            select(DataSource)
            .where(DataSource.user_id == user_id)
            .order_by(DataSource.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        return list(rows), total

    async def get_source(self, db: AsyncSession, user_id: uuid.UUID, source_id: uuid.UUID) -> DataSource | None:
        q = select(DataSource).where(DataSource.id == source_id, DataSource.user_id == user_id)
        return (await db.execute(q)).scalar_one_or_none()

    async def delete_source(self, db: AsyncSession, user_id: uuid.UUID, source_id: uuid.UUID) -> bool:
        ds = await self.get_source(db, user_id, source_id)
        if not ds:
            return False

        tables_q = select(DataTable).where(DataTable.data_source_id == ds.id)
        tables = (await db.execute(tables_q)).scalars().all()
        for tbl in tables:
            await self.drop_pg_table(tbl.pg_schema, tbl.pg_table_name)

        await db.delete(ds)
        await db.commit()
        return True

    async def list_tables(
        self, db: AsyncSession, user_id: uuid.UUID, offset: int = 0, limit: int = 50
    ) -> tuple[list[DataTable], int]:
        count_q = select(func.count()).select_from(DataTable).where(DataTable.user_id == user_id)
        total = (await db.execute(count_q)).scalar() or 0

        q = (
            select(DataTable)
            .where(DataTable.user_id == user_id)
            .order_by(DataTable.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = (await db.execute(q)).scalars().all()
        return list(rows), total

    async def get_table(self, db: AsyncSession, user_id: uuid.UUID, table_id: uuid.UUID) -> DataTable | None:
        q = select(DataTable).where(DataTable.id == table_id, DataTable.user_id == user_id)
        return (await db.execute(q)).scalar_one_or_none()

    async def update_table(
        self, db: AsyncSession, user_id: uuid.UUID, table_id: uuid.UUID,
        display_name: str | None = None, description: str | None = None,
    ) -> DataTable | None:
        tbl = await self.get_table(db, user_id, table_id)
        if not tbl:
            return None
        if display_name is not None:
            tbl.display_name = display_name
        if description is not None:
            tbl.description = description
        tbl.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(tbl)
        return tbl

    async def delete_table(self, db: AsyncSession, user_id: uuid.UUID, table_id: uuid.UUID) -> bool:
        tbl = await self.get_table(db, user_id, table_id)
        if not tbl:
            return False

        await self.drop_pg_table(tbl.pg_schema, tbl.pg_table_name)

        ds_id = tbl.data_source_id
        await db.delete(tbl)
        await db.commit()

        remaining = (await db.execute(
            select(func.count()).select_from(DataTable).where(DataTable.data_source_id == ds_id)
        )).scalar() or 0
        ds = (await db.execute(select(DataSource).where(DataSource.id == ds_id))).scalar_one_or_none()
        if ds:
            ds.table_count = remaining
            await db.commit()

        return True

    async def get_table_data(
        self, db: AsyncSession, user_id: uuid.UUID, table_id: uuid.UUID,
        page: int = 1, page_size: int = 50,
    ) -> dict | None:
        tbl = await self.get_table(db, user_id, table_id)
        if not tbl:
            return None

        qualified = f"{_pg_identifier(tbl.pg_schema)}.{_pg_identifier(tbl.pg_table_name)}"
        offset = (page - 1) * page_size

        count_sql = f"SELECT COUNT(*) FROM {qualified}"
        data_sql = f"SELECT * FROM {qualified} LIMIT :limit OFFSET :offset"

        async with self.engine.connect() as conn:
            total_result = await conn.execute(sa_text(count_sql))
            total = total_result.scalar() or 0

            result = await conn.execute(sa_text(data_sql), {"limit": page_size, "offset": offset})
            columns = list(result.keys())
            rows = [list(row) for row in result.fetchall()]

        col_types = None
        if tbl.columns_meta:
            col_types = [cm.get("type", "varchar") for cm in tbl.columns_meta]

        return {
            "table_id": tbl.id,
            "table_name": tbl.display_name or tbl.name,
            "columns": columns,
            "column_types": col_types,
            "rows": rows,
            "total_count": total,
            "page": page,
            "page_size": page_size,
            "has_more": offset + page_size < total,
        }

    async def get_table_schema(self, db: AsyncSession, user_id: uuid.UUID, table_id: uuid.UUID) -> dict | None:
        tbl = await self.get_table(db, user_id, table_id)
        if not tbl:
            return None

        return {
            "table_id": tbl.id,
            "table_name": tbl.display_name or tbl.name,
            "pg_schema": tbl.pg_schema,
            "pg_table_name": tbl.pg_table_name,
            "columns": tbl.columns_meta or [],
            "row_count": tbl.row_count,
        }

    # ===================== MinIO =====================

    async def _backup_to_minio(
        self, user_id: uuid.UUID, data_source_id: uuid.UUID, filename: str, content: bytes
    ) -> None:
        if not self.minio:
            return
        try:
            bucket = settings.minio_bucket
            await asyncio.to_thread(self._sync_ensure_bucket, bucket)
            key = f"user-data/{user_id}/{data_source_id}/{filename}"
            data = io.BytesIO(content)
            await asyncio.to_thread(
                self.minio.put_object, bucket, key, data, len(content)
            )
            logger.info("MinIO backup: %s/%s", bucket, key)
        except Exception:
            logger.warning("MinIO backup failed (non-fatal)", exc_info=True)

    def _sync_ensure_bucket(self, bucket: str) -> None:
        if not self.minio.bucket_exists(bucket):
            self.minio.make_bucket(bucket)
