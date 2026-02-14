"""
测试1: DeepSeek-Chat 普通对话模式（非流式）
- 模型: deepseek-chat (v3.2)
- 模式: 普通对话，不开启思考
- 目的: 记录完整的返回字段结构
"""
import json
from openai import OpenAI

API_KEY = "sk-360507b80072494caebb32e290bef60c"
BASE_URL = "https://api.deepseek.com"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

print("=" * 80)
print("测试1: DeepSeek-Chat 普通对话模式（非流式）")
print("=" * 80)

messages = [
    {"role": "system", "content": "你是一个有帮助的AI助手。"},
    {"role": "user", "content": "用一句话解释什么是量子计算"},
]

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=messages,
)

# ===== 打印完整的原始响应 =====
print("\n--- 原始响应 (raw JSON) ---")
raw = response.model_dump()
print(json.dumps(raw, indent=2, ensure_ascii=False))

# ===== 逐字段解析 =====
print("\n--- 逐字段解析 ---")
print(f"id:                {response.id}")
print(f"object:            {response.object}")
print(f"created:           {response.created}")
print(f"model:             {response.model}")
print(f"system_fingerprint:{response.system_fingerprint}")

choice = response.choices[0]
print(f"\nchoices[0].index:          {choice.index}")
print(f"choices[0].finish_reason:  {choice.finish_reason}")
print(f"choices[0].message.role:   {choice.message.role}")
print(f"choices[0].message.content:{choice.message.content}")
print(f"choices[0].message.tool_calls: {choice.message.tool_calls}")

# 检查是否有 reasoning_content 字段
msg_dict = choice.message.model_dump()
print(f"\nchoices[0].message 全部字段: {list(msg_dict.keys())}")
if "reasoning_content" in msg_dict:
    print(f"choices[0].message.reasoning_content: {msg_dict['reasoning_content']}")

usage = response.usage
print(f"\nusage.prompt_tokens:          {usage.prompt_tokens}")
print(f"usage.completion_tokens:      {usage.completion_tokens}")
print(f"usage.total_tokens:           {usage.total_tokens}")

# 检查 usage 中是否有额外字段（如 prompt_cache_hit_tokens 等）
usage_dict = usage.model_dump()
print(f"usage 全部字段: {list(usage_dict.keys())}")
for k, v in usage_dict.items():
    if k not in ("prompt_tokens", "completion_tokens", "total_tokens"):
        print(f"  usage.{k}: {v}")

print("\n" + "=" * 80)
print("测试1 完成")
print("=" * 80)
