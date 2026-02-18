-- 初始化 kk_nl2sql 数据库和用户
-- 此脚本在 PostgreSQL 容器首次启动时执行

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'kk_nl2sql') THEN
        CREATE USER kk_nl2sql WITH PASSWORD 'kk_nl2sql_secret_2026';
    END IF;
END
$$;

SELECT 'CREATE DATABASE kk_nl2sql OWNER kk_nl2sql'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kk_nl2sql')\gexec

GRANT ALL PRIVILEGES ON DATABASE kk_nl2sql TO kk_nl2sql;

-- Enable extensions for UUID generation (PG < 13)
\c kk_nl2sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 用户数据隔离 schema
CREATE SCHEMA IF NOT EXISTS user_data;

-- 授权应用用户访问 user_data schema
GRANT ALL ON SCHEMA user_data TO kk_nl2sql;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA user_data TO kk_nl2sql;
ALTER DEFAULT PRIVILEGES IN SCHEMA user_data GRANT ALL PRIVILEGES ON TABLES TO kk_nl2sql;
