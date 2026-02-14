"""
测试4: DeepSeek-Chat JSON Output 模式
- 模型: deepseek-chat (v3.2)
- 模式: response_format = json_object
- 目的: 验证 JSON 结构化输出能力，记录返回字段
"""
import json
from openai import OpenAI

API_KEY = "sk-360507b80072494caebb32e290bef60c"
BASE_URL = "https://api.deepseek.com"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

print("=" * 80)
print("测试4: DeepSeek-Chat JSON Output 模式")
print("=" * 80)

system_prompt = """
The user will provide some exam text. Please parse the "question" and "answer" and output them in JSON format.

EXAMPLE INPUT:
Which is the highest mountain in the world? Mount Everest.

EXAMPLE JSON OUTPUT:
{
    "question": "Which is the highest mountain in the world?",
    "answer": "Mount Everest"
}
"""

user_prompt = "世界上最长的河流是什么？尼罗河。"

messages = [
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": user_prompt},
]

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=messages,
    response_format={"type": "json_object"},
)

# ===== 原始响应 =====
print("\n--- 原始响应 (raw JSON) ---")
raw = response.model_dump()
print(json.dumps(raw, indent=2, ensure_ascii=False))

# ===== 解析 JSON content =====
content = response.choices[0].message.content
print(f"\n--- message.content (raw string) ---\n{content}")

try:
    parsed = json.loads(content)
    print(f"\n--- 解析后的 JSON ---")
    print(json.dumps(parsed, indent=2, ensure_ascii=False))
except json.JSONDecodeError as e:
    print(f"\n--- JSON 解析失败: {e} ---")

# ===== finish_reason =====
print(f"\nfinish_reason: {response.choices[0].finish_reason}")

usage = response.usage.model_dump()
print(f"usage: {json.dumps(usage, indent=2)}")

print("\n" + "=" * 80)
print("测试4 完成")
print("=" * 80)
