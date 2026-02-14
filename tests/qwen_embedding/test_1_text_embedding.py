"""Qwen Embedding 测试 1: text-embedding-v4 文本向量化"""
import json
from openai import OpenAI

API_KEY = "sk-ee882ade795e46c1afc5fb1600439484"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

# ---- 测试 1a: 单文本, 默认维度 (1024) ----
print("=" * 60)
print("TEST 1a: 单文本, 默认维度 (1024)")
print("=" * 60)

resp = client.embeddings.create(
    model="text-embedding-v4",
    input="衣服的质量杠杠的",
)
data = resp.model_dump()
print(f"model: {data['model']}")
print(f"object: {data['object']}")
print(f"data count: {len(data['data'])}")
print(f"data[0].object: {data['data'][0]['object']}")
print(f"data[0].index: {data['data'][0]['index']}")
print(f"embedding dim: {len(data['data'][0]['embedding'])}")
print(f"embedding[:5]: {data['data'][0]['embedding'][:5]}")
print(f"usage: {data['usage']}")

# ---- 测试 1b: 批量文本 ----
print("\n" + "=" * 60)
print("TEST 1b: 批量文本 (3条)")
print("=" * 60)

resp2 = client.embeddings.create(
    model="text-embedding-v4",
    input=["衣服的质量杠杠的", "这家餐厅很好吃", "今天天气不错"],
)
data2 = resp2.model_dump()
print(f"data count: {len(data2['data'])}")
for d in data2["data"]:
    print(f"  index={d['index']}, dim={len(d['embedding'])}, first3={d['embedding'][:3]}")
print(f"usage: {data2['usage']}")

# ---- 测试 1c: 不同维度 ----
print("\n" + "=" * 60)
print("TEST 1c: 不同维度 (256, 512, 1024, 2048)")
print("=" * 60)

for dim in [256, 512, 1024, 2048]:
    resp_dim = client.embeddings.create(
        model="text-embedding-v4",
        input="测试不同向量维度",
        dimensions=dim,
    )
    actual_dim = len(resp_dim.data[0].embedding)
    print(f"  requested={dim}, actual={actual_dim}, match={dim == actual_dim}")

# ---- 完整原始响应 ----
print("\n" + "=" * 60)
print("FULL RESPONSE (test 1a):")
print("=" * 60)
# 截断 embedding 显示
full = resp.model_dump()
full["data"][0]["embedding"] = full["data"][0]["embedding"][:10] + ["...truncated..."]
print(json.dumps(full, ensure_ascii=False, indent=2))
