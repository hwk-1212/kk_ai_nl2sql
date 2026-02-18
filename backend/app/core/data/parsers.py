"""文件解析器 — 将 Excel / CSV / SQLite 转换为 (列名, 行数据) 结构。

TODO (Phase 3a): 实现各解析器
"""
from __future__ import annotations
import io
from dataclasses import dataclass


@dataclass
class ParsedTable:
    name: str
    columns: list[str]
    rows: list[list]
    row_count: int


class ExcelParser:
    """解析 .xlsx / .xls 文件，每个 Sheet 对应一张表。
    TODO (Phase 3a): 使用 openpyxl 实现
    """

    def parse(self, content: bytes) -> list[ParsedTable]:
        raise NotImplementedError("Phase 3a")


class CsvParser:
    """解析 .csv 文件为单张表。
    TODO (Phase 3a): 使用 pandas 实现，自动推断列类型
    """

    def parse(self, content: bytes, table_name: str = "data") -> ParsedTable:
        raise NotImplementedError("Phase 3a")


class SqliteParser:
    """解析 .sqlite / .db 文件，每个表对应一张 ParsedTable。
    TODO (Phase 3a): 使用 sqlite3 标准库实现
    """

    def parse(self, content: bytes) -> list[ParsedTable]:
        raise NotImplementedError("Phase 3a")


def get_parser(filename: str) -> ExcelParser | CsvParser | SqliteParser:
    """根据文件扩展名返回对应解析器。"""
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext in ("xlsx", "xls"):
        return ExcelParser()
    if ext == "csv":
        return CsvParser()
    if ext in ("sqlite", "db"):
        return SqliteParser()
    raise ValueError(f"Unsupported file type: {ext}")
