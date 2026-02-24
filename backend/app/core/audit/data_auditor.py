"""数据审计服务 — 记录所有 NL2SQL 数据操作的审计日志。

支持 5 种操作类型：query / write / denied / upload / drop_table。
自动提取 client_ip (X-Forwarded-For) 和 User-Agent。
SQL 脱敏：隐藏字面值常量。
"""
from __future__ import annotations

import hashlib
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select, func, cast, Date, and_, text as sa_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_audit_log import DataAuditLog

if TYPE_CHECKING:
    from fastapi import Request
    from app.models.user import User
    from app.models.data_table import DataTable

logger = logging.getLogger(__name__)

_LITERAL_RE = re.compile(r"'[^']*'")
_NUMBER_RE = re.compile(r"\b\d+\.?\d*\b")


class DataAuditor:
    """NL2SQL 操作审计日志服务。"""

    async def log_query(
        self,
        db: AsyncSession,
        user: "User",
        table: "DataTable | None",
        sql: str,
        execution_ms: int,
        row_count: int = 0,
        *,
        status: str = "success",
        error: str | None = None,
        request: "Request | None" = None,
        conversation_id: uuid.UUID | None = None,
    ) -> None:
        entry = DataAuditLog(
            user_id=user.id,
            tenant_id=getattr(user, "tenant_id", None),
            conversation_id=conversation_id,
            action="query",
            data_table_id=table.id if table else None,
            table_name=table.pg_table_name if table else None,
            sql_text=self._sanitize_sql(sql),
            sql_hash=self._sql_hash(sql),
            execution_ms=execution_ms,
            result_row_count=row_count if row_count is not None else 0,
            status=status,
            error_message=error,
            client_ip=self._extract_ip(request),
            user_agent=self._extract_ua(request),
        )
        db.add(entry)
        try:
            await db.flush()
        except Exception as e:
            logger.warning("Audit log_query flush failed: %s", e)
            try:
                await db.rollback()
            except Exception:
                pass

    async def log_write(
        self,
        db: AsyncSession,
        user: "User",
        table: "DataTable",
        sql: str,
        affected_rows: int,
        execution_ms: int,
        *,
        before_snapshot: dict | None = None,
        after_snapshot: dict | None = None,
        status: str = "success",
        error: str | None = None,
        request: "Request | None" = None,
        conversation_id: uuid.UUID | None = None,
    ) -> None:
        entry = DataAuditLog(
            user_id=user.id,
            tenant_id=getattr(user, "tenant_id", None),
            conversation_id=conversation_id,
            action="write",
            data_table_id=table.id,
            table_name=table.pg_table_name,
            sql_text=self._sanitize_sql(sql),
            sql_hash=self._sql_hash(sql),
            affected_rows=affected_rows,
            execution_ms=execution_ms,
            status=status,
            error_message=error,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            client_ip=self._extract_ip(request),
            user_agent=self._extract_ua(request),
        )
        db.add(entry)
        try:
            await db.flush()
        except Exception as e:
            logger.warning("Audit log_write flush failed: %s", e)

    async def log_denied(
        self,
        db: AsyncSession,
        user: "User",
        table: "DataTable | None",
        sql: str,
        reason: str,
        *,
        request: "Request | None" = None,
    ) -> None:
        entry = DataAuditLog(
            user_id=user.id,
            tenant_id=getattr(user, "tenant_id", None),
            action="denied",
            data_table_id=table.id if table else None,
            table_name=table.pg_table_name if table else None,
            sql_text=self._sanitize_sql(sql),
            sql_hash=self._sql_hash(sql),
            status="denied",
            error_message=reason,
            client_ip=self._extract_ip(request),
            user_agent=self._extract_ua(request),
        )
        db.add(entry)
        try:
            await db.flush()
        except Exception as e:
            logger.warning("Audit log_denied flush failed: %s", e)

    async def log_upload(
        self,
        db: AsyncSession,
        user: "User",
        data_source_id: uuid.UUID,
        tables_created: list[str],
        *,
        request: "Request | None" = None,
    ) -> None:
        entry = DataAuditLog(
            user_id=user.id,
            tenant_id=getattr(user, "tenant_id", None),
            action="upload",
            table_name=", ".join(tables_created) if tables_created else None,
            status="success",
            extra={"data_source_id": str(data_source_id), "tables": tables_created},
            client_ip=self._extract_ip(request),
            user_agent=self._extract_ua(request),
        )
        db.add(entry)
        try:
            await db.flush()
        except Exception as e:
            logger.warning("Audit log_upload flush failed: %s", e)

    async def log_drop_table(
        self,
        db: AsyncSession,
        user: "User",
        table: "DataTable",
        *,
        request: "Request | None" = None,
    ) -> None:
        entry = DataAuditLog(
            user_id=user.id,
            tenant_id=getattr(user, "tenant_id", None),
            action="drop_table",
            data_table_id=table.id,
            table_name=table.pg_table_name,
            status="success",
            client_ip=self._extract_ip(request),
            user_agent=self._extract_ua(request),
        )
        db.add(entry)
        try:
            await db.flush()
        except Exception as e:
            logger.warning("Audit log_drop_table flush failed: %s", e)

    # ── query methods ───────────────────────────────────────

    async def get_logs(
        self,
        db: AsyncSession,
        *,
        tenant_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        table_id: uuid.UUID | None = None,
        action: str | None = None,
        status: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict:
        q = select(DataAuditLog)
        count_q = select(func.count(DataAuditLog.id))

        filters = []
        if tenant_id:
            filters.append(DataAuditLog.tenant_id == tenant_id)
        if user_id:
            filters.append(DataAuditLog.user_id == user_id)
        if table_id:
            filters.append(DataAuditLog.data_table_id == table_id)
        if action:
            filters.append(DataAuditLog.action == action)
        if status:
            filters.append(DataAuditLog.status == status)
        if start_date:
            filters.append(DataAuditLog.created_at >= start_date)
        if end_date:
            filters.append(DataAuditLog.created_at <= end_date)

        if filters:
            combined = and_(*filters)
            q = q.where(combined)
            count_q = count_q.where(combined)

        total = (await db.execute(count_q)).scalar() or 0
        q = q.order_by(DataAuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        result = await db.execute(q)
        logs = result.scalars().all()

        return {
            "items": [self._serialize(log) for log in logs],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_stats(
        self,
        db: AsyncSession,
        *,
        tenant_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
        days: int = 7,
    ) -> dict:
        from datetime import timedelta
        since = datetime.now(timezone.utc) - timedelta(days=days)

        filters = [DataAuditLog.created_at >= since]
        if tenant_id:
            filters.append(DataAuditLog.tenant_id == tenant_id)
        if user_id:
            filters.append(DataAuditLog.user_id == user_id)
        combined = and_(*filters)

        # 总计
        totals = await db.execute(
            select(
                func.count(DataAuditLog.id).label("total"),
                func.coalesce(func.avg(DataAuditLog.execution_ms), 0).label("avg_ms"),
            ).where(combined)
        )
        row = totals.one()

        # 按操作分组
        by_action = await db.execute(
            select(
                DataAuditLog.action,
                func.count(DataAuditLog.id).label("count"),
            ).where(combined).group_by(DataAuditLog.action)
        )
        action_counts = {r.action: int(r.count) for r in by_action.all()}

        # 按状态分组
        by_status = await db.execute(
            select(
                DataAuditLog.status,
                func.count(DataAuditLog.id).label("count"),
            ).where(combined).group_by(DataAuditLog.status)
        )
        status_counts = {r.status: int(r.count) for r in by_status.all()}

        # 按日趋势
        daily = await db.execute(
            select(
                cast(DataAuditLog.created_at, Date).label("day"),
                func.count(DataAuditLog.id).label("count"),
            ).where(combined)
            .group_by(cast(DataAuditLog.created_at, Date))
            .order_by(cast(DataAuditLog.created_at, Date))
        )
        daily_trend = [{"date": str(r.day), "count": int(r.count)} for r in daily.all()]

        # 高频表 Top 5
        top_tables = await db.execute(
            select(
                DataAuditLog.table_name,
                func.count(DataAuditLog.id).label("count"),
            ).where(combined, DataAuditLog.table_name.isnot(None))
            .group_by(DataAuditLog.table_name)
            .order_by(func.count(DataAuditLog.id).desc())
            .limit(5)
        )
        top_table_list = [{"table": r.table_name, "count": int(r.count)} for r in top_tables.all()]

        total_count = int(row.total)
        failed_count = status_counts.get("failed", 0) + status_counts.get("denied", 0)

        return {
            "period_days": days,
            "total_operations": total_count,
            "avg_execution_ms": round(float(row.avg_ms), 1),
            "failure_rate": round(failed_count / total_count * 100, 2) if total_count > 0 else 0,
            "by_action": action_counts,
            "by_status": status_counts,
            "daily_trend": daily_trend,
            "top_tables": top_table_list,
        }

    # ── helpers ──────────────────────────────────────────────

    @staticmethod
    def _extract_ip(request: "Request | None") -> str | None:
        if not request:
            return None
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return None

    @staticmethod
    def _extract_ua(request: "Request | None") -> str | None:
        if not request:
            return None
        return request.headers.get("user-agent", "")[:500]

    @staticmethod
    def _sanitize_sql(sql: str) -> str:
        """隐藏字面值常量。"""
        sanitized = _LITERAL_RE.sub("'***'", sql)
        return sanitized

    @staticmethod
    def _sql_hash(sql: str) -> str:
        normalized = _LITERAL_RE.sub("?", sql)
        normalized = _NUMBER_RE.sub("?", normalized)
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    @staticmethod
    def _serialize(log: DataAuditLog) -> dict:
        return {
            "id": str(log.id),
            "user_id": str(log.user_id),
            "tenant_id": str(log.tenant_id) if log.tenant_id else None,
            "conversation_id": str(log.conversation_id) if log.conversation_id else None,
            "action": log.action,
            "data_table_id": str(log.data_table_id) if log.data_table_id else None,
            "table_name": log.table_name,
            "sql_text": log.sql_text,
            "affected_rows": log.affected_rows,
            "execution_ms": log.execution_ms,
            "result_row_count": log.result_row_count,
            "status": log.status,
            "error_message": log.error_message,
            "client_ip": log.client_ip,
            "extra": log.extra,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
