"""Qwen Embedding 测试 3: qwen3-rerank 文本重排序"""
import json
import requests

API_KEY = "sk-ee882ade795e46c1afc5fb1600439484"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# ---- 测试 3a: 基础 rerank ----
print("=" * 60)
print("TEST 3a: qwen3-rerank 基础重排序")
print("=" * 60)

url = "https://dashscope.aliyuncs.com/compatible-api/v1/reranks"

payload = {
    "model": "qwen3-rerank",
    "documents": [
        "文本排序模型广泛用于搜索引擎和推荐系统中，它们根据文本相关性对候选文本进行排序",
        "量子计算是计算科学的一个前沿领域",
        "预训练语言模型的发展给文本排序模型带来了新的进展",
    ],
    "query": "什么是文本排序模型",
    "top_n": 2,
}

resp = requests.post(url, headers=headers, json=payload)
data = resp.json()
print(f"Status: {resp.status_code}")
print(f"Response:\n{json.dumps(data, ensure_ascii=False, indent=2)}")

# ---- 测试 3b: 带 instruct 的 rerank ----
print("\n" + "=" * 60)
print("TEST 3b: qwen3-rerank 带 instruct")
print("=" * 60)

payload_b = {
    "model": "qwen3-rerank",
    "documents": [
        "FastAPI 是一个现代的 Python Web 框架，性能极高",
        "React 是 Facebook 开发的前端 JavaScript 库",
        "Docker 容器化技术让应用部署变得简单",
        "SQLAlchemy 是 Python 最流行的 ORM 框架",
        "Redis 是一个高性能的内存数据库",
    ],
    "query": "Python 后端开发用什么框架",
    "top_n": 3,
    "instruct": "Given a technical question, retrieve relevant passages that answer the query.",
}

resp_b = requests.post(url, headers=headers, json=payload_b)
data_b = resp_b.json()
print(f"Status: {resp_b.status_code}")
print(f"Response:\n{json.dumps(data_b, ensure_ascii=False, indent=2)}")

# ---- 测试 3c: gte-rerank-v2 ----
print("\n" + "=" * 60)
print("TEST 3c: gte-rerank-v2")
print("=" * 60)

payload_c = {
    "model": "gte-rerank-v2",
    "documents": [
        "文本排序模型广泛用于搜索引擎和推荐系统中",
        "量子计算是计算科学的一个前沿领域",
        "预训练语言模型的发展给文本排序模型带来了新的进展",
    ],
    "query": "什么是文本排序模型",
    "top_n": 2,
}

resp_c = requests.post(url, headers=headers, json=payload_c)
data_c = resp_c.json()
print(f"Status: {resp_c.status_code}")
print(f"Response:\n{json.dumps(data_c, ensure_ascii=False, indent=2)}")
