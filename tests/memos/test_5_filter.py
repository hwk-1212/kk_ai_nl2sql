"""MemOS API 测试 5: 使用过滤器"""
import requests
import json

MEMOS_API_KEY = "mpg-Ka3hih7B9/CMpw0KYlF5vC0DhTUERuuAEpUvlfYg"
MEMOS_BASE_URL = "https://memos.memtensor.cn/api/openmem/v1"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Token {MEMOS_API_KEY}",
}

query_text = "我去过哪些城市旅游？"

data = {
    "user_id": "kk_nl2sql_test_user_001",
    "query": query_text,
    "filter": {
        "and": [
            {"create_time": {"gt": "2025-01-01"}},
        ]
    },
}

url = f"{MEMOS_BASE_URL}/search/memory"

print("=" * 60)
print("TEST 5: 使用过滤器")
print(f"URL: {url}")
print(f"Query: {query_text}")
print(f"Filter: {json.dumps(data['filter'], ensure_ascii=False)}")
print(f"Request Body:\n{json.dumps(data, ensure_ascii=False, indent=2)}")
print("=" * 60)

res = requests.post(url=url, headers=headers, data=json.dumps(data))

print(f"\nStatus Code: {res.status_code}")
print(f"\nResponse Body:\n{json.dumps(res.json(), ensure_ascii=False, indent=2)}")
