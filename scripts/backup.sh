#!/usr/bin/env bash
# ============================================================
# kk_gpt_aibot 全量备份脚本
# 用法: ./scripts/backup.sh [备份目录]
# 定时: crontab -e → 0 3 * * * /path/to/scripts/backup.sh
# ============================================================
set -euo pipefail

BACKUP_ROOT="${1:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_ROOT}/${DATE}"

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

mkdir -p "${BACKUP_DIR}"
info "备份目录: ${BACKUP_DIR}"

# ============================================================
# 1. PostgreSQL 备份
# ============================================================
info "开始 PostgreSQL 备份..."
docker exec kk_gpt_postgres pg_dump \
    -U kk_gpt \
    -d kk_gpt \
    --format=custom \
    --compress=6 \
    --verbose \
    > "${BACKUP_DIR}/postgres_kk_gpt.dump" 2>"${BACKUP_DIR}/postgres_backup.log"

PG_SIZE=$(du -sh "${BACKUP_DIR}/postgres_kk_gpt.dump" | cut -f1)
info "PostgreSQL 备份完成: ${PG_SIZE}"

# ============================================================
# 2. Redis RDB 备份
# ============================================================
info "开始 Redis 备份..."
docker exec kk_gpt_redis redis-cli BGSAVE > /dev/null 2>&1
sleep 2
docker cp kk_gpt_redis:/data/dump.rdb "${BACKUP_DIR}/redis_dump.rdb" 2>/dev/null || warn "Redis dump.rdb 不存在 (可能是首次)"

if [ -f "${BACKUP_DIR}/redis_dump.rdb" ]; then
    REDIS_SIZE=$(du -sh "${BACKUP_DIR}/redis_dump.rdb" | cut -f1)
    info "Redis 备份完成: ${REDIS_SIZE}"
else
    warn "Redis 备份跳过"
fi

# ============================================================
# 3. MinIO (业务) 文件备份 — 使用 mc (MinIO Client)
# ============================================================
info "开始 MinIO 文件备份..."
if command -v mc &>/dev/null; then
    mc alias set kk_backup http://localhost:9000 admin admin123456 --api S3v4 2>/dev/null || true
    mc mirror kk_backup/kk-gpt-files "${BACKUP_DIR}/minio_files/" 2>"${BACKUP_DIR}/minio_backup.log" || warn "MinIO mirror 失败 (bucket 可能为空)"
    MINIO_SIZE=$(du -sh "${BACKUP_DIR}/minio_files/" 2>/dev/null | cut -f1 || echo "0")
    info "MinIO 备份完成: ${MINIO_SIZE}"
else
    # 回退: 直接拷贝 volume
    if [ -d ./docker/volumes/minio/data ]; then
        cp -r ./docker/volumes/minio/data "${BACKUP_DIR}/minio_data/"
        MINIO_SIZE=$(du -sh "${BACKUP_DIR}/minio_data/" | cut -f1)
        info "MinIO Volume 备份完成: ${MINIO_SIZE}"
    else
        warn "MinIO 备份跳过 (mc 未安装且 volume 不存在)"
    fi
fi

# ============================================================
# 4. Milvus — 备份 volume (standalone 模式最简单)
# ============================================================
info "开始 Milvus 数据备份..."
if [ -d ./docker/volumes/milvus ]; then
    tar czf "${BACKUP_DIR}/milvus_data.tar.gz" \
        -C ./docker/volumes/milvus . 2>/dev/null || warn "Milvus tar 失败"
    MILVUS_SIZE=$(du -sh "${BACKUP_DIR}/milvus_data.tar.gz" 2>/dev/null | cut -f1 || echo "0")
    info "Milvus 备份完成: ${MILVUS_SIZE}"
else
    warn "Milvus volume 不存在, 跳过"
fi

# ============================================================
# 5. 计算总大小 & 清理旧备份 (保留 7 天)
# ============================================================
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
info "========================================="
info "备份完成! 总大小: ${TOTAL_SIZE}"
info "位置: ${BACKUP_DIR}"
info "========================================="

# 清理 7 天前的备份
if [ -d "${BACKUP_ROOT}" ]; then
    find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
    OLD_COUNT=$(find "${BACKUP_ROOT}" -maxdepth 1 -type d -mtime +7 2>/dev/null | wc -l)
    if [ "${OLD_COUNT}" -gt 0 ]; then
        info "已清理 ${OLD_COUNT} 个过期备份"
    fi
fi

info "备份任务结束 ✓"
