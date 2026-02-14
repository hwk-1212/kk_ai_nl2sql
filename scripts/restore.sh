#!/usr/bin/env bash
# ============================================================
# kk_gpt_aibot 数据恢复脚本
# 用法: ./scripts/restore.sh <备份目录>
# 例如: ./scripts/restore.sh ./backups/20260211_030000
# ============================================================
set -euo pipefail

BACKUP_DIR="${1:-}"
if [ -z "${BACKUP_DIR}" ]; then
    echo "用法: $0 <备份目录>"
    echo "例如: $0 ./backups/20260211_030000"
    exit 1
fi

if [ ! -d "${BACKUP_DIR}" ]; then
    echo "错误: 备份目录不存在 → ${BACKUP_DIR}"
    exit 1
fi

GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "⚠️  警告: 此操作将覆盖当前数据库数据!"
echo "备份来源: ${BACKUP_DIR}"
read -p "确认恢复? (输入 yes 继续): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "已取消"
    exit 0
fi

# ============================================================
# 1. PostgreSQL 恢复
# ============================================================
PG_DUMP="${BACKUP_DIR}/postgres_kk_gpt.dump"
if [ -f "${PG_DUMP}" ]; then
    info "开始 PostgreSQL 恢复..."
    # 先终止所有连接
    docker exec kk_gpt_postgres psql -U postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='kk_gpt' AND pid <> pg_backend_pid();" \
        2>/dev/null || true
    # 删除重建数据库
    docker exec kk_gpt_postgres psql -U postgres -c "DROP DATABASE IF EXISTS kk_gpt;" 2>/dev/null || true
    docker exec kk_gpt_postgres psql -U postgres -c "CREATE DATABASE kk_gpt OWNER kk_gpt;" 2>/dev/null || true
    # 恢复
    docker exec -i kk_gpt_postgres pg_restore \
        -U kk_gpt \
        -d kk_gpt \
        --verbose \
        --no-owner \
        --no-acl \
        < "${PG_DUMP}" 2>"${BACKUP_DIR}/postgres_restore.log" || warn "PostgreSQL 恢复有警告 (见日志)"
    info "PostgreSQL 恢复完成"
else
    warn "跳过 PostgreSQL (dump 文件不存在)"
fi

# ============================================================
# 2. Redis 恢复
# ============================================================
REDIS_DUMP="${BACKUP_DIR}/redis_dump.rdb"
if [ -f "${REDIS_DUMP}" ]; then
    info "开始 Redis 恢复..."
    docker exec kk_gpt_redis redis-cli SHUTDOWN NOSAVE 2>/dev/null || true
    sleep 1
    docker cp "${REDIS_DUMP}" kk_gpt_redis:/data/dump.rdb
    docker start kk_gpt_redis 2>/dev/null || docker restart kk_gpt_redis
    info "Redis 恢复完成"
else
    warn "跳过 Redis (dump 文件不存在)"
fi

# ============================================================
# 3. MinIO 恢复
# ============================================================
if [ -d "${BACKUP_DIR}/minio_files" ]; then
    info "开始 MinIO 恢复..."
    if command -v mc &>/dev/null; then
        mc alias set kk_backup http://localhost:9000 admin admin123456 --api S3v4 2>/dev/null || true
        mc mirror "${BACKUP_DIR}/minio_files/" kk_backup/kk-gpt-files/ --overwrite 2>/dev/null || warn "MinIO mirror 恢复失败"
        info "MinIO 恢复完成"
    else
        warn "mc 未安装, 跳过 MinIO 恢复"
    fi
elif [ -d "${BACKUP_DIR}/minio_data" ]; then
    info "恢复 MinIO Volume..."
    cp -r "${BACKUP_DIR}/minio_data/"* ./docker/volumes/minio/data/ 2>/dev/null || warn "MinIO Volume 恢复失败"
    info "MinIO Volume 恢复完成"
else
    warn "跳过 MinIO (备份文件不存在)"
fi

# ============================================================
# 4. Milvus 恢复
# ============================================================
MILVUS_TAR="${BACKUP_DIR}/milvus_data.tar.gz"
if [ -f "${MILVUS_TAR}" ]; then
    info "开始 Milvus 恢复 (需先停止 Milvus)..."
    docker stop kk_gpt_milvus 2>/dev/null || true
    sleep 2
    rm -rf ./docker/volumes/milvus/*
    tar xzf "${MILVUS_TAR}" -C ./docker/volumes/milvus/
    docker start kk_gpt_milvus
    info "Milvus 恢复完成"
else
    warn "跳过 Milvus (tar 文件不存在)"
fi

echo ""
info "========================================="
info "恢复完成! 建议重启所有服务:"
info "  docker compose restart"
info "========================================="
