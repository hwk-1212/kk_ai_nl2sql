# Phase 1: 项目脚手架 + 健康检查

## 目标

搭建前后端项目骨架，实现健康检查接口，**验证前后端接口联通性**。

## 后端 (FastAPI)

### 目录结构初始化

```
backend/
├── Dockerfile
├── requirements.txt
├── alembic/
│   └── alembic.ini
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app + lifespan
│   ├── config.py             # Pydantic Settings (从 .env 读取)
│   ├── dependencies.py       # 公共依赖注入
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       └── health.py     # 健康检查路由
│   ├── db/
│   │   ├── session.py        # async SQLAlchemy session
│   │   ├── redis.py          # Redis client
│   │   ├── milvus.py         # Milvus client
│   │   └── minio.py          # MinIO client
│   └── models/
│       └── base.py           # SQLAlchemy Base
```

### 健康检查端点

```
GET /api/v1/health
```

返回各依赖服务连接状态：

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "services": {
    "postgresql": "ok",
    "redis": "ok",
    "milvus": "ok",
    "minio": "ok",
    "memos": "ok"
  },
  "timestamp": "2026-02-11T12:00:00Z"
}
```

### 关键依赖 (requirements.txt)

```
fastapi
uvicorn[standard]
sqlalchemy[asyncio]
asyncpg
alembic
redis
pymilvus
minio
httpx
pydantic-settings
python-dotenv
```

## 前端 (React + TypeScript)

### 目录结构初始化

```
frontend/
├── Dockerfile
├── package.json
├── vite.config.ts           # dev proxy /api → backend:8000
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx              # 简单路由骨架
│   ├── index.css            # Tailwind imports
│   ├── services/
│   │   └── api.ts           # axios instance + /api/v1 base
│   ├── components/
│   │   └── HealthCheck.tsx  # 健康检查展示组件
│   └── types/
│       └── index.ts
```

### 健康检查组件

- 页面加载时调用 `GET /api/v1/health`
- 以卡片形式展示各服务状态 (绿色 OK / 红色 Error)
- 自动刷新按钮

### 关键依赖 (package.json)

```
react, react-dom, typescript
vite, @vitejs/plugin-react
tailwindcss, postcss, autoprefixer
axios
lucide-react
```

## Nginx 配置

```
docker/nginx/nginx.conf
```

- `/` → frontend:3000
- `/api/` → backend:8000
- WebSocket/SSE 相关 header 配置

## 目录结构变更 (2026-02-11)

Docker 容器相关文件统一归入 `docker/` 目录：

```
docker/
├── nginx/nginx.conf        # Nginx 反向代理配置
├── postgres/init.sql        # PostgreSQL 初始化脚本
└── volumes/                 # 容器运行时数据卷 (gitignored)
    ├── postgres/
    ├── redis/
    ├── milvus/
    └── minio/
```

## 验证标准

- [x] `docker-compose up -d` 启动 backend + frontend + nginx
- [x] 访问 `http://localhost/api/v1/health` 返回 JSON，所有服务 "ok"
- [x] 访问 `http://localhost` 前端页面正常加载
- [x] 前端 HealthCheck 组件正确展示后端返回的各服务状态
- [x] Vite dev 模式下 proxy 正常工作 (开发体验)

## 完成记录

- **完成时间**: 2026-02-11
- **容器总数**: 10 (PG, Redis, etcd, Milvus-MinIO, Milvus, Attu, MinIO, Backend, Frontend, Nginx)
- **健康状态**: 全部 healthy
- **验证结果**: `/api/v1/health` 返回 `{"status":"healthy"}`, 前端 `http://localhost` HTTP 200
