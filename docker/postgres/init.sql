-- 初始化 kk_gpt 数据库和用户
-- 此脚本在 PostgreSQL 容器首次启动时执行

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kk_gpt') THEN
        CREATE USER kk_gpt WITH PASSWORD 'kk_gpt_secret_2026';
    END IF;
END
$$;

SELECT 'CREATE DATABASE kk_gpt OWNER kk_gpt'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kk_gpt')\gexec

GRANT ALL PRIVILEGES ON DATABASE kk_gpt TO kk_gpt;

-- Enable extensions for UUID generation (PG < 13)
\c kk_gpt
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
