"""SQL 安全检查器 — 拦截危险 DDL / DML，限制查询复杂度。

使用 sqlparse 解析 SQL，拒绝非 SELECT 语句以及包含危险关键字的查询。

TODO (Phase 3e): 完善检查规则
"""
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)

BLOCKED_KEYWORDS = frozenset([
    "DROP", "DELETE", "TRUNCATE", "UPDATE", "INSERT", "ALTER",
    "CREATE", "GRANT", "REVOKE", "EXECUTE", "EXEC", "CALL",
    "COPY", "VACUUM", "ANALYZE",
])


class SqlSecurityError(Exception):
    pass


class SqlChecker:
    """SQL 安全检查器，仅允许只读 SELECT 语句。"""

    def check(self, sql: str) -> None:
        """检查 SQL 是否安全，不安全则抛出 SqlSecurityError。
        TODO (Phase 3e): 使用 sqlparse 做 AST 级检查
        """
        try:
            import sqlparse
            parsed = sqlparse.parse(sql)
        except ImportError:
            parsed = None

        upper = sql.upper()
        for kw in BLOCKED_KEYWORDS:
            if kw in upper:
                raise SqlSecurityError(f"Blocked SQL keyword: {kw}")

        if parsed:
            for stmt in parsed:
                stmt_type = stmt.get_type()
                if stmt_type and stmt_type != "SELECT":
                    raise SqlSecurityError(f"Only SELECT statements are allowed, got: {stmt_type}")

    def is_safe(self, sql: str) -> bool:
        """返回 True 表示 SQL 通过安全检查。"""
        try:
            self.check(sql)
            return True
        except SqlSecurityError:
            return False
