"""SQL 安全检查器 — 拦截危险 DDL / DML，自动 LIMIT，提取表名。

功能:
  - check(): 安全检查，区分只读/写模式
  - enforce_limit(): 无 LIMIT 的 SELECT 自动追加
  - extract_table_names(): 从 SQL 中提取引用的表名
"""
from __future__ import annotations

import re
import logging
from dataclasses import dataclass

import sqlparse
from sqlparse.sql import IdentifierList, Identifier, Where, Parenthesis
from sqlparse.tokens import Keyword, DML

logger = logging.getLogger(__name__)


class SqlSecurityError(Exception):
    pass


@dataclass
class SecurityResult:
    is_safe: bool
    blocked_reason: str | None = None


BLOCKED_PATTERNS = [
    re.compile(r"\bDROP\s+DATABASE\b", re.I),
    re.compile(r"\bALTER\s+SYSTEM\b", re.I),
    re.compile(r"\bCREATE\s+ROLE\b", re.I),
    re.compile(r"\bCREATE\s+USER\b", re.I),
    re.compile(r"\bGRANT\s+", re.I),
    re.compile(r"\bREVOKE\s+", re.I),
    re.compile(r"\bpg_read_file\b", re.I),
    re.compile(r"\bpg_write_file\b", re.I),
    re.compile(r"\bCOPY\s+.*\s+TO\s+PROGRAM\b", re.I | re.S),
    re.compile(r"\bLO_IMPORT\b", re.I),
    re.compile(r"\bLO_EXPORT\b", re.I),
    re.compile(r"\bSET\s+ROLE\b", re.I),
    re.compile(r"\bSET\s+SESSION\b", re.I),
    re.compile(r"\bCREATE\s+EXTENSION\b", re.I),
    re.compile(r"\bDROP\s+SCHEMA\b", re.I),
    re.compile(r"\bDROP\s+TABLE\b", re.I),
    re.compile(r"\bALTER\s+TABLE\b", re.I),
    re.compile(r"\bCREATE\s+TABLE\b", re.I),
    re.compile(r"\bCREATE\s+INDEX\b", re.I),
    re.compile(r"\bVACUUM\b", re.I),
    re.compile(r";\s*(DROP|DELETE|TRUNCATE|ALTER|CREATE)\b", re.I),
]

WRITE_PATTERNS = [
    re.compile(r"\bINSERT\s+INTO\b", re.I),
    re.compile(r"\bUPDATE\s+\S+\s+SET\b", re.I),
    re.compile(r"\bDELETE\s+FROM\b", re.I),
    re.compile(r"\bTRUNCATE\b", re.I),
]

_LIMIT_RE = re.compile(r"\bLIMIT\s+\d+", re.I)
_TABLE_FROM_RE = re.compile(r"\bFROM\s+([\"']?\w+[\"']?(?:\s*\.\s*[\"']?\w+[\"']?)?)", re.I)
_TABLE_JOIN_RE = re.compile(r"\bJOIN\s+([\"']?\w+[\"']?(?:\s*\.\s*[\"']?\w+[\"']?)?)", re.I)
_TABLE_INTO_RE = re.compile(r"\bINTO\s+([\"']?\w+[\"']?(?:\s*\.\s*[\"']?\w+[\"']?)?)", re.I)
_TABLE_UPDATE_RE = re.compile(r"\bUPDATE\s+([\"']?\w+[\"']?(?:\s*\.\s*[\"']?\w+[\"']?)?)", re.I)


class SQLSecurityChecker:
    """SQL 安全检查器"""

    def check(self, sql: str, allow_write: bool = False) -> SecurityResult:
        """检查 SQL 安全性。"""
        sql_stripped = sql.strip().rstrip(";").strip()
        if not sql_stripped:
            return SecurityResult(is_safe=False, blocked_reason="Empty SQL")

        try:
            parsed_stmts = sqlparse.parse(sql_stripped)
            real_stmts = [s for s in parsed_stmts if s.get_type() is not None or str(s).strip()]
            if len(real_stmts) > 1:
                return SecurityResult(is_safe=False, blocked_reason="Multiple statements not allowed")
        except Exception:
            if ";" in sql_stripped:
                return SecurityResult(is_safe=False, blocked_reason="Multiple statements not allowed")

        for pattern in BLOCKED_PATTERNS:
            if pattern.search(sql_stripped):
                return SecurityResult(is_safe=False, blocked_reason=f"Blocked pattern: {pattern.pattern}")

        is_write = any(p.search(sql_stripped) for p in WRITE_PATTERNS)
        if is_write and not allow_write:
            return SecurityResult(is_safe=False, blocked_reason="Write operations not allowed in read-only mode")

        try:
            parsed = sqlparse.parse(sql_stripped)
            for stmt in parsed:
                stmt_type = stmt.get_type()
                if stmt_type:
                    if not allow_write and stmt_type != "SELECT":
                        return SecurityResult(
                            is_safe=False,
                            blocked_reason=f"Only SELECT allowed, got: {stmt_type}"
                        )
                    if allow_write and stmt_type not in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                        return SecurityResult(
                            is_safe=False,
                            blocked_reason=f"Statement type not allowed: {stmt_type}"
                        )
        except Exception:
            pass

        return SecurityResult(is_safe=True)

    def enforce_limit(self, sql: str, max_rows: int = 1000) -> str:
        """如果 SELECT 没有 LIMIT，自动追加。"""
        sql_stripped = sql.strip().rstrip(";").strip()
        if _LIMIT_RE.search(sql_stripped):
            return sql_stripped
        upper = sql_stripped.upper()
        if upper.startswith("SELECT") or upper.startswith("WITH"):
            return f"{sql_stripped} LIMIT {max_rows}"
        return sql_stripped

    _KEYWORD_EXCLUSIONS = frozenset({
        "SELECT", "WHERE", "SET", "VALUES", "DEFAULT", "AS", "ON",
        "AND", "OR", "NOT", "NULL", "TRUE", "FALSE", "CASE", "WHEN",
        "THEN", "ELSE", "END", "IN", "EXISTS", "BETWEEN", "LIKE",
        "IS", "ALL", "ANY", "SOME", "LATERAL", "UNNEST", "DUAL",
    })

    def extract_table_names(self, sql: str) -> list[str]:
        """从 SQL 中提取引用的表名 (含 schema.table 格式)。"""
        tables = set()
        for pattern in [_TABLE_FROM_RE, _TABLE_JOIN_RE, _TABLE_INTO_RE, _TABLE_UPDATE_RE]:
            for match in pattern.finditer(sql):
                raw = match.group(1).strip().strip("\"'")
                if raw.upper() not in self._KEYWORD_EXCLUSIONS:
                    tables.add(raw)
        return list(tables)
