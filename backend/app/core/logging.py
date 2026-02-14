"""日志脱敏 — 防止 API Key / 密码泄漏到日志"""
import logging
import re

# 匹配常见 API Key / Token / Password 模式
_SENSITIVE_PATTERNS = [
    # sk-xxx 格式的 API Key
    (re.compile(r'(sk-)[A-Za-z0-9]{8,}'), r'\1***'),
    # Bearer token
    (re.compile(r'(Bearer\s+)[A-Za-z0-9._-]{8,}'), r'\1***'),
    # password / secret 字段值
    (re.compile(r'((?:password|secret|token|api_key|apikey)["\s:=]+)["\']?[^\s"\']{4,}', re.IGNORECASE),
     r'\1***'),
]


class SanitizeFilter(logging.Filter):
    """日志过滤器: 自动脱敏敏感信息"""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            for pattern, replacement in _SENSITIVE_PATTERNS:
                record.msg = pattern.sub(replacement, record.msg)
        # 处理 args 中的字符串
        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: pattern.sub(replacement, v) if isinstance(v, str) else v
                    for k, v in record.args.items()
                    for pattern, replacement in _SENSITIVE_PATTERNS
                }
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    self._sanitize_value(a) for a in record.args
                )
        return True

    @staticmethod
    def _sanitize_value(value):
        if isinstance(value, str):
            for pattern, replacement in _SENSITIVE_PATTERNS:
                value = pattern.sub(replacement, value)
        return value


def setup_logging(level: str = "INFO"):
    """配置应用日志 (带脱敏)"""
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # 添加脱敏 filter 到所有 handler
    sanitize = SanitizeFilter()
    for handler in root.handlers:
        handler.addFilter(sanitize)

    # 如果没有 handler, 添加默认的
    if not root.handlers:
        handler = logging.StreamHandler()
        handler.addFilter(sanitize)
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        root.addHandler(handler)
