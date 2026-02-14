from minio import Minio
from app.config import get_settings

settings = get_settings()

minio_client = Minio(
    endpoint=settings.minio_endpoint,
    access_key=settings.minio_root_user,
    secret_key=settings.minio_root_password,
    secure=settings.minio_secure,
)


def check_minio_health() -> bool:
    try:
        minio_client.list_buckets()
        return True
    except Exception:
        return False
