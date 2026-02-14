from pymilvus import connections, utility
from app.config import get_settings

settings = get_settings()


def connect_milvus() -> None:
    connections.connect(
        alias="default",
        host=settings.milvus_host,
        port=settings.milvus_port,
    )


def check_milvus_health() -> bool:
    try:
        connect_milvus()
        # list_collections 成功即表明连接正常
        utility.list_collections()
        return True
    except Exception:
        return False
    finally:
        try:
            connections.disconnect("default")
        except Exception:
            pass
