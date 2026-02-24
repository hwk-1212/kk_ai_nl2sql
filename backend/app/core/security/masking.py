"""脱敏规则引擎 — 7 种脱敏规则"""
import re
import logging

logger = logging.getLogger(__name__)


MASKING_RULES = {
    "last4": lambda v: "****" + str(v)[-4:] if v and len(str(v)) >= 4 else "****",
    "first3": lambda v: str(v)[:3] + "****" if v and len(str(v)) >= 3 else "****",
    "phone": lambda v: (
        str(v)[:3] + "****" + str(v)[-4:]
        if v and len(str(v)) >= 7
        else "****"
    ),
    "email_mask": lambda v: (
        str(v)[0] + "***@" + str(v).split("@")[1]
        if v and "@" in str(v) and len(str(v).split("@")[0]) > 0
        else "***@***"
    ),
    "id_card": lambda v: "**************" + str(v)[-4:] if v and len(str(v)) >= 4 else "**************",
    "full_mask": lambda v: "******",
    "amount": lambda v: "***.**",
}


def apply_mask(value: any, rule: str) -> any:
    """应用脱敏规则到单个值"""
    if value is None:
        return None

    fn = MASKING_RULES.get(rule)
    if not fn:
        logger.warning(f"Unknown masking rule: {rule}, using full_mask")
        fn = MASKING_RULES["full_mask"]

    try:
        return fn(value)
    except Exception as e:
        logger.warning(f"Masking failed for rule={rule}, value={value}: {e}")
        return "******"
