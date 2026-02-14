"""
测试2: DeepSeek-Chat 思考模式（非流式）
- 模型: deepseek-chat (v3.2) + thinking enabled
- 模式: 思考模式，非流式
- 目的: 记录 reasoning_content 字段结构
"""
import json
from openai import OpenAI

API_KEY = "sk-360507b80072494caebb32e290bef60c"
BASE_URL = "https://api.deepseek.com"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

print("=" * 80)
print("测试2: DeepSeek-Chat 思考模式（非流式）")
print("=" * 80)

messages = [
    {"role": "user", "content": "9.11 和 9.8 哪个大？"},
]

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=messages,
    extra_body={"thinking": {"type": "enabled"}},
)

# ===== 原始响应 =====
print("\n--- 原始响应 (raw JSON) ---")
raw = response.model_dump()
print(json.dumps(raw, indent=2, ensure_ascii=False))

# ===== 逐字段解析 =====
print("\n--- 逐字段解析 ---")
print(f"id:      {response.id}")
print(f"model:   {response.model}")
print(f"created: {response.created}")

choice = response.choices[0]
msg = choice.message
msg_dict = msg.model_dump()

print(f"\nmessage 全部字段: {list(msg_dict.keys())}")
print(f"  role:              {msg.role}")
print(f"  content:           {msg.content}")

# 关键：reasoning_content
if hasattr(msg, "reasoning_content"):
    print(f"  reasoning_content: {msg.reasoning_content}")
elif "reasoning_content" in msg_dict:
    print(f"  reasoning_content: {msg_dict['reasoning_content']}")
else:
    print("  reasoning_content: [字段不存在，检查 raw JSON]")

print(f"  finish_reason: {choice.finish_reason}")

usage = response.usage
usage_dict = usage.model_dump()
print(f"\nusage 全部字段: {list(usage_dict.keys())}")
for k, v in usage_dict.items():
    print(f"  {k}: {v}")

print("\n" + "=" * 80)
print("测试2 完成")
print("=" * 80)
