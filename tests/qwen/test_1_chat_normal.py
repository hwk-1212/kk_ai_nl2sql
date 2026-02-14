"""
测试1: 千问 qwen-plus 普通对话（非流式）
- 模型: qwen-plus
- 目的: 记录完整返回字段结构，与 DeepSeek 做对比
"""
import json
from openai import OpenAI

API_KEY = "sk-ee882ade795e46c1afc5fb1600439484"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

print("=" * 80)
print("测试1: 千问 qwen-plus 普通对话（非流式）")
print("=" * 80)

messages = [
    {"role": "system", "content": "你是一个有帮助的AI助手。"},
    {"role": "user", "content": "用一句话解释什么是量子计算"},
]

response = client.chat.completions.create(
    model="qwen-plus",
    messages=messages,
)

# ===== 原始响应 =====
print("\n--- 原始响应 (raw JSON) ---")
raw = response.model_dump()
print(json.dumps(raw, indent=2, ensure_ascii=False))

# ===== 逐字段解析 =====
print("\n--- 逐字段解析 ---")
print(f"id:                 {response.id}")
print(f"object:             {response.object}")
print(f"created:            {response.created}")
print(f"model:              {response.model}")
print(f"system_fingerprint: {response.system_fingerprint}")

choice = response.choices[0]
print(f"\nchoices[0].index:          {choice.index}")
print(f"choices[0].finish_reason:  {choice.finish_reason}")
print(f"choices[0].message.role:   {choice.message.role}")
print(f"choices[0].message.content:{choice.message.content}")
print(f"choices[0].message.tool_calls: {choice.message.tool_calls}")

msg_dict = choice.message.model_dump()
print(f"\nmessage 全部字段: {list(msg_dict.keys())}")

usage = response.usage
usage_dict = usage.model_dump()
print(f"\nusage 全部字段: {list(usage_dict.keys())}")
for k, v in usage_dict.items():
    print(f"  {k}: {v}")

# ===== 多轮对话测试 =====
print("\n" + "-" * 40)
print("多轮对话测试")
print("-" * 40)

messages.append({"role": "assistant", "content": response.choices[0].message.content})
messages.append({"role": "user", "content": "能举一个具体的应用场景吗？"})

response2 = client.chat.completions.create(
    model="qwen-plus",
    messages=messages,
)

raw2 = response2.model_dump()
print(json.dumps(raw2, indent=2, ensure_ascii=False))

print(f"\n第2轮回复: {response2.choices[0].message.content}")

usage2 = response2.usage.model_dump()
print(f"\n第2轮 usage:")
for k, v in usage2.items():
    print(f"  {k}: {v}")

print("\n" + "=" * 80)
print("测试1 完成")
print("=" * 80)
