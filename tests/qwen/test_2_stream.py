"""
测试2: 千问 qwen-plus 流式输出
- 模型: qwen-plus
- 模式: stream=True + stream_options={"include_usage": True}
- 目的: 记录每个 chunk 的字段结构
"""
import json
from openai import OpenAI

API_KEY = "sk-ee882ade795e46c1afc5fb1600439484"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

print("=" * 80)
print("测试2: 千问 qwen-plus 流式输出")
print("=" * 80)

messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "用两句话介绍Python语言"},
]

response = client.chat.completions.create(
    model="qwen-plus",
    messages=messages,
    stream=True,
    stream_options={"include_usage": True},
)

content = ""
chunk_count = 0
first_chunk_raw = None
last_chunk_raw = None
usage_chunk_raw = None

for chunk in response:
    chunk_count += 1
    chunk_dict = chunk.model_dump()

    if chunk_count == 1:
        first_chunk_raw = chunk_dict

    # 千问流式: 最后一个 chunk 可能 choices 为空，只有 usage
    if chunk.choices:
        last_chunk_raw = chunk_dict
        delta = chunk.choices[0].delta
        if delta.content:
            content += delta.content
            print(delta.content, end="", flush=True)
    elif chunk.usage:
        usage_chunk_raw = chunk_dict

print("\n")

print(f"--- 总 chunk 数: {chunk_count} ---")

print(f"\n--- 第一个 chunk (raw) ---")
print(json.dumps(first_chunk_raw, indent=2, ensure_ascii=False))

print(f"\n--- 最后一个有 content 的 chunk (raw) ---")
print(json.dumps(last_chunk_raw, indent=2, ensure_ascii=False))

if usage_chunk_raw:
    print(f"\n--- usage chunk (raw) --- ★ 千问特殊: 单独的 usage chunk ---")
    print(json.dumps(usage_chunk_raw, indent=2, ensure_ascii=False))

print(f"\n--- 完整 content ---\n{content}")

# delta 字段
if first_chunk_raw and first_chunk_raw.get("choices"):
    delta_keys = list(first_chunk_raw["choices"][0].get("delta", {}).keys())
    print(f"\nchunk.choices[0].delta 字段: {delta_keys}")

print("\n" + "=" * 80)
print("测试2 完成")
print("=" * 80)
