"""Gunicorn 配置 — 生产部署用"""
import multiprocessing
import os

# Worker
workers = int(os.getenv("WORKERS", min(multiprocessing.cpu_count() * 2 + 1, 4)))
worker_class = "uvicorn.workers.UvicornWorker"
bind = "0.0.0.0:8000"

# Timeout (SSE 长连接需要较长超时)
timeout = int(os.getenv("TIMEOUT", 120))
graceful_timeout = 30
keepalive = 65

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Restart workers after N requests (防止内存泄漏)
max_requests = 1000
max_requests_jitter = 50

# Preload app for memory sharing (copy-on-write)
preload_app = False  # 异步应用不建议 preload
