"""MemOS API 测试 4: 获取用户画像"""
import requests
import json

MEMOS_API_KEY = "mpg-Ka3hih7B9/CMpw0KYlF5vC0DhTUERuuAEpUvlfYg"
MEMOS_BASE_URL = "https://memos.memtensor.cn/api/openmem/v1"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Token {MEMOS_API_KEY}",
}

query_text = "我的人物关键词是什么？"

data = {
    "user_id": "kk_nl2sql_test_user_001",
    "query": query_text,
}

url = f"{MEMOS_BASE_URL}/search/memory"

print("=" * 60)
print("TEST 4: 获取用户画像")
print(f"URL: {url}")
print(f"Query: {query_text}")
print(f"Request Body:\n{json.dumps(data, ensure_ascii=False, indent=2)}")
print("=" * 60)

res = requests.post(url=url, headers=headers, data=json.dumps(data))

print(f"\nStatus Code: {res.status_code}")
print(f"\nResponse Body:\n{json.dumps(res.json(), ensure_ascii=False, indent=2)}")
