"""Qwen Embedding 测试 2: qwen3-vl-embedding 多模态向量"""
import json
import requests

API_KEY = "sk-ee882ade795e46c1afc5fb1600439484"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# ---- 测试 2a: 文本+图片 融合向量 ----
print("=" * 60)
print("TEST 2a: 文本+图片 融合向量 (qwen3-vl-embedding)")
print("=" * 60)

payload_a = {
    "model": "qwen3-vl-embedding",
    "input": {
        "contents": [
            {
                "text": "这是一段测试文本，用于生成多模态融合向量",
                "image": "https://dashscope.oss-cn-beijing.aliyuncs.com/images/256_1.png",
            }
        ]
    },
    "parameters": {
        "dimension": 1024,
        "output_type": "dense",
    },
}

url = "https://dashscope.aliyuncs.com/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding"

resp_a = requests.post(url, headers=headers, json=payload_a)
data_a = resp_a.json()
print(f"Status: {resp_a.status_code}")

if "output" in data_a:
    embeddings = data_a["output"]["embeddings"]
    print(f"embeddings count: {len(embeddings)}")
    for emb in embeddings:
        print(f"  index={emb.get('index')}, type={emb.get('type','N/A')}, dim={len(emb.get('embedding', []))}, first3={emb.get('embedding', [])[:3]}")
    print(f"usage: {data_a.get('usage')}")
else:
    print(f"Response: {json.dumps(data_a, ensure_ascii=False, indent=2)}")

# ---- 测试 2b: 文本+图片+视频 融合向量 ----
print("\n" + "=" * 60)
print("TEST 2b: 文本+图片+视频 融合向量")
print("=" * 60)

payload_b = {
    "model": "qwen3-vl-embedding",
    "input": {
        "contents": [
            {
                "text": "这是一段测试文本，用于生成多模态融合向量",
                "image": "https://dashscope.oss-cn-beijing.aliyuncs.com/images/256_1.png",
                "video": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250107/lbcemt/new+video.mp4",
            }
        ]
    },
    "parameters": {
        "dimension": 1024,
        "output_type": "dense",
        "fps": 0.5,
    },
}

resp_b = requests.post(url, headers=headers, json=payload_b)
data_b = resp_b.json()
print(f"Status: {resp_b.status_code}")

if "output" in data_b:
    embeddings = data_b["output"]["embeddings"]
    print(f"embeddings count: {len(embeddings)}")
    for emb in embeddings:
        print(f"  index={emb.get('index')}, type={emb.get('type','N/A')}, dim={len(emb.get('embedding', []))}")
    print(f"usage: {data_b.get('usage')}")
else:
    print(f"Response: {json.dumps(data_b, ensure_ascii=False, indent=2)}")

# ---- 完整响应结构 (2a) ----
print("\n" + "=" * 60)
print("FULL RESPONSE STRUCTURE (test 2a):")
print("=" * 60)
display = json.loads(json.dumps(data_a))
if "output" in display:
    for emb in display["output"]["embeddings"]:
        emb["embedding"] = emb.get("embedding", [])[:5] + ["...truncated..."]
print(json.dumps(display, ensure_ascii=False, indent=2))
