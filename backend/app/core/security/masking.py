"""字段脱敏引擎 — 对查询结果中的敏感字段进行脱敏处理。

支持: 手机号、身份证、邮箱、姓名、银行卡号 等预设规则，
以及自定义正则脱敏规则。

TODO (Phase 3e): 实现脱敏规则引擎
"""
from __future__ import annotations
import re
import logging

logger = logging.getLogger(__name__)

MASKING_RULES: dict[str, re.Pattern] = {
    "phone":    re.compile(r"1[3-9]\d{9}"),
    "id_card":  re.compile(r"\d{17}[\dXx]"),
    "email":    re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
    "bankcard": re.compile(r"\d{16,19}"),
}


def mask_phone(value: str) -> str:
    return re.sub(r"(\d{3})\d{4}(\d{4})", r"\1****\2", value)


def mask_id_card(value: str) -> str:
    return re.sub(r"(\d{6})\d{8}(\w{4})", r"\1********\2", value)


def mask_email(value: str) -> str:
    local, _, domain = value.partition("@")
    return local[:2] + "***@" + domain if len(local) > 2 else "***@" + domain


class MaskingEngine:
    """查询结果字段脱敏引擎。"""

    def __init__(self, db_session):
        self.db = db_session

    async def get_masked_columns(self, user_id, table_id) -> dict[str, str]:
        """返回需要脱敏的列名 → 脱敏类型映射。
        TODO (Phase 3e): 查询 ColumnPermission.mask_type
        """
        raise NotImplementedError("Phase 3e")

    def mask_rows(self, columns: list[str], rows: list[list], mask_config: dict[str, str]) -> list[list]:
        """对行数据按 mask_config 脱敏，返回处理后的行。
        TODO (Phase 3e): 遍历各列应用对应脱敏函数
        """
        raise NotImplementedError("Phase 3e")
