# Phase 0: Docker 基础设施更新

**状态**: ✅ 已完成 (2026-02-18)

## 目标

在现有 10 容器基础上，新增 Celery Worker / Celery Beat 服务，更新 PostgreSQL 初始化脚本创建 `user_data` schema，安装新 Python 依赖，更新 `.env` 配置。项目统一命名为 `kk_nl2sql_aibot`。

---

## 前置条件

- Phase 0~7 (老) 已完成，10 容器全部 healthy
- 现有 Docker Compose 可正常 `docker-compose up -d`

---

## 0.1 docker-compose.yml 新增服务

### Celery Worker

```yaml
celery-worker:
  build: ./backend
  command: celery -A app.tasks worker --loglevel=info --concurrency=2
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  env_file: .env
  volumes:
    - ./backend:/app
  restart: unless-stopped
```

### Celery Beat

```yaml
celery-beat:
  build: ./backend
  command: celery -A app.tasks beat --loglevel=info --scheduler celery.beat:PersistentScheduler
  depends_on:
    redis:
      condition: service_healthy
  env_file: .env
  volumes:
    - ./backend:/app
  restart: unless-stopped
```

---

## 0.2 PostgreSQL 初始化脚本更新

**文件**: `docker/postgres/init.sql`

新增:

```sql
-- 用户数据隔离 schema
CREATE SCHEMA IF NOT EXISTS user_data;

-- 授权应用用户访问 user_data schema
GRANT ALL ON SCHEMA user_data TO kk_nl2sql;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA user_data TO kk_nl2sql;
ALTER DEFAULT PRIVILEGES IN SCHEMA user_data GRANT ALL PRIVILEGES ON TABLES TO kk_nl2sql;
```

---

## 0.3 后端新增依赖

**文件**: `backend/requirements.txt` 新增:

```
celery[redis]
sqlparse
tiktoken
openpyxl
python-multipart
aiofiles
```

| 依赖 | 用途 |
|------|------|
| `celery[redis]` | 异步任务队列 + 定时调度 |
| `sqlparse` | SQL 解析/格式化/安全检查 |
| `tiktoken` | Token 计算 (OpenAI 兼容编码) |
| `openpyxl` | Excel (.xlsx) 解析 |
| `python-multipart` | 文件上传 multipart 解析 |
| `aiofiles` | 异步文件 I/O |

---

## 0.4 Celery 应用初始化

**新增文件**: `backend/app/tasks/__init__.py`

```python
from celery import Celery
from app.config import get_settings

settings = get_settings()
celery_app = Celery(
    "kk_nl2sql",
    broker=f"redis://{settings.redis_host}:{settings.redis_port}/1",
    backend=f"redis://{settings.redis_host}:{settings.redis_port}/2",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery_app.autodiscover_tasks(["app.tasks"])
```

---

## 0.5 .env 更新

新增环境变量:

```env
# Celery
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# 数据管理
MAX_UPLOAD_SIZE_MB=100
ALLOWED_UPLOAD_TYPES=xlsx,csv,sqlite,xls

# SQL 安全
SQL_EXECUTION_TIMEOUT=30
SQL_MAX_RESULT_ROWS=1000
```

---

## 0.6 docker-compose.prod.yml 同步更新

生产配置同步新增 celery-worker / celery-beat 服务，增加资源限制:

| 服务 | Memory | CPU |
|------|--------|-----|
| celery-worker | 512M | 1.0 |
| celery-beat | 256M | 0.25 |

---

## 任务清单

- [x] `docker-compose.yml` 新增 celery-worker 服务
- [x] `docker-compose.yml` 新增 celery-beat 服务
- [x] `docker/postgres/init.sql` 新增 `user_data` schema + 权限
- [x] `backend/requirements.txt` 新增依赖
- [x] `backend/app/tasks/__init__.py` Celery 应用初始化
- [x] `.env` / `.env.example` 新增配置项
- [x] `docker-compose.prod.yml` 同步更新
- [x] 验证通过

---

## 验证标准

- [x] `docker-compose up -d` 全部容器启动正常 (12/12: 原 10 + celery-worker + celery-beat)
- [x] `docker exec kk_nl2sql_postgres psql -U kk_nl2sql -d kk_nl2sql -c "\dn"` 显示 `user_data` schema
- [x] `docker exec kk_nl2sql_celery_worker celery -A app.tasks inspect ping` 返回 pong
- [x] `docker exec kk_nl2sql_celery_beat celery -A app.tasks inspect active` 无报错
- [x] `pip install -r requirements.txt` 无依赖冲突

---

## 迁移说明

若 PostgreSQL 数据卷在项目重命名前已存在 (用户名为 `kk_gpt`)，需手动创建新用户和数据库：

```bash
docker exec kk_nl2sql_postgres psql -U postgres -c "CREATE USER kk_nl2sql WITH PASSWORD 'kk_nl2sql_secret_2026';"
docker exec kk_nl2sql_postgres psql -U postgres -c "CREATE DATABASE kk_nl2sql OWNER kk_nl2sql;"
docker exec kk_nl2sql_postgres psql -U postgres -d kk_nl2sql -c "
  CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
  CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
  CREATE SCHEMA IF NOT EXISTS user_data;
  GRANT ALL ON SCHEMA user_data TO kk_nl2sql;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA user_data TO kk_nl2sql;
"
```

---

## 新增/修改文件列表

| 文件 | 类型 | 说明 |
|------|------|------|
| `docker-compose.yml` | MOD | 新增 celery-worker, celery-beat 服务 |
| `docker-compose.prod.yml` | MOD | 同步新增 celery 服务 + 资源限制 |
| `docker/postgres/init.sql` | MOD | 新增 user_data schema |
| `backend/requirements.txt` | MOD | 新增 celery/sqlparse/tiktoken 等依赖 |
| `backend/app/tasks/__init__.py` | NEW | Celery 应用配置 |
| `.env` / `.env.example` | MOD | 新增 Celery + 数据管理配置 |
