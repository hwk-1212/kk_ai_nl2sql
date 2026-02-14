from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置，从环境变量 / .env 读取"""

    # App
    app_name: str = "kk_gpt_aibot"
    app_version: str = "0.1.0"
    debug: bool = False

    # PostgreSQL
    postgres_user: str = "kk_gpt"
    postgres_password: str = "kk_gpt_secret_2026"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "kk_gpt"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""

    @property
    def redis_url(self) -> str:
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/0"
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    # Milvus
    milvus_host: str = "localhost"
    milvus_port: int = 19530

    # MinIO
    minio_endpoint: str = "localhost:9000"
    minio_root_user: str = "admin"
    minio_root_password: str = "admin123456"
    minio_secure: bool = False

    # MemOS Cloud
    memos_api_url: str = "https://memos.memtensor.cn/api/openmem/v1"
    memos_api_key: str = ""
    memory_recall_enabled: bool = True
    memory_save_enabled: bool = True
    memory_relativity_threshold: float = 0.3
    memory_recall_timeout: float = 3.0

    # LLM — DeepSeek
    deepseek_api_key: str = "sk-360507b80072494caebb32e290bef60c"
    deepseek_base_url: str = "https://api.deepseek.com"

    # LLM — Qwen (千问)
    qwen_api_key: str = "sk-ee882ade795e46c1afc5fb1600439484"
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"

    # JWT
    jwt_secret_key: str = "kk-gpt-aibot-jwt-secret-2026-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # RAG
    rag_enabled: bool = True
    rag_top_k: int = 5
    rag_ann_top_k: int = 20
    rag_use_rerank: bool = True
    minio_bucket: str = "kk-gpt-files"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
