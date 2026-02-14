# Phase 0: Docker 基础设施 ✅ 已完成

## 目标

本机零安装，所有存储依赖通过 Docker Compose 一键启动。

## 服务清单

| 服务 | 镜像 | 端口 | 用途 | 状态 |
|------|------|------|------|------|
| PostgreSQL | `registry.cn-shenzhen.aliyuncs.com/colovu/postgres:12.4` | 5432 | 主数据库 | ✅ healthy |
| Redis | `redis:7-alpine` | 6379 | 缓存/会话/限流/Celery | ✅ healthy |
| etcd | `quay.io/coreos/etcd:v3.5.25` | 内部 | Milvus 元数据 | ✅ healthy |
| Milvus MinIO | `minio/minio:RELEASE.2024-12-18T13-15-44Z` | 内部 | Milvus 内部存储 | ✅ healthy |
| Milvus | `milvusdb/milvus:v2.6.10` | 19530, 9091 | 向量数据库 | ✅ healthy |
| Attu | `zilliz/attu:v2.6.3` | 8000 | Milvus 可视化管理 | ✅ running |
| MinIO (业务) | `minio/minio:RELEASE.2025-04-22T22-12-26Z` | 9000, 9001 | 文件上传存储 | ✅ healthy |

**注意**: 记忆系统使用 MemOS Cloud 在线服务 (https://memos-docs.openmem.net/)，不需要本地容器。

## 交付物

- [x] `docker-compose.yml` — 7 个容器完整编排
- [x] `.env.example` / `.env` — 环境变量模板
- [x] `docker/postgres/init.sql` — PostgreSQL 自动初始化脚本 (创建 kk_gpt 用户和数据库)
- [x] `.gitignore` — 排除 .env 和数据目录
- [x] 各服务 healthcheck 配置
- [x] 本地数据卷挂载 (`./docker/volumes/`)

## 访问方式

| 服务 | 地址 | 备注 |
|------|------|------|
| PostgreSQL | `localhost:5432` | 用户 `kk_gpt` / 密码 `kk_gpt_secret_2026` / 数据库 `kk_gpt` |
| Redis | `localhost:6379` | 无密码 |
| Milvus gRPC | `localhost:19530` | 向量数据库连接 |
| Milvus Health | `localhost:9091/healthz` | 健康检查 |
| Attu | `http://localhost:8080` | Milvus 可视化管理，已自动连接 Milvus |
| MinIO API | `localhost:9000` | 对象存储 API |
| MinIO Console | `http://kk_gpt_minio.orb.local:9001` | 账号 `admin` / 密码 `admin123456` (OrbStack 环境) |

## 验证结果

- [x] `docker-compose up -d` 全部容器启动正常 (7/7)
- [x] PostgreSQL: `psql -U kk_gpt -d kk_gpt -c "SELECT 1"` 成功
- [x] Redis: `redis-cli ping` 返回 PONG
- [x] Milvus: `http://localhost:9091/healthz` 返回 OK
- [x] MinIO: API HTTP 200
- [x] Attu: `http://localhost:8000` HTTP 200

## 注意事项

- 使用 OrbStack 作为 Docker 运行时，MinIO Console 需通过 `kk_gpt_minio.orb.local:9001` 访问
- 已配置 Docker Hub 镜像加速 (`~/.orbstack/config/docker.json`)：`docker.1ms.run`, `docker.xuanyuan.me`
- PostgreSQL 使用阿里云镜像 (colovu/postgres)，需通过 `docker/postgres/init.sql` 初始化用户和数据库
- Milvus 内部 MinIO 不暴露端口，仅 Milvus 容器内部通信使用
- Attu v2.6.3 对应 Milvus v2.6.x，通过 `MILVUS_URL: milvus:19530` 内网直连
