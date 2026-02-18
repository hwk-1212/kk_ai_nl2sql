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
