"""MemOS API 测试 3: 在对话中使用记忆 (search/memory with conversation context)"""
import requests
import json

MEMOS_API_KEY = "mpg-Ka3hih7B9/CMpw0KYlF5vC0DhTUERuuAEpUvlfYg"
MEMOS_BASE_URL = "https://memos.memtensor.cn/api/openmem/v1"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Token {MEMOS_API_KEY}",
}

# 用户当前发言，直接作为 query
query_text = "国庆节我要去云南玩了，有什么美食推荐吗？"

data = {
    "user_id": "kk_gpt_test_user_001",
    "conversation_id": "conv_test_0211_03",
    "query": query_text,
}

url = f"{MEMOS_BASE_URL}/search/memory"

print("=" * 60)
print("TEST 3: 对话中使用记忆")
print(f"URL: {url}")
print(f"Query: {query_text}")
print(f"Request Body:\n{json.dumps(data, ensure_ascii=False, indent=2)}")
print("=" * 60)

res = requests.post(url=url, headers=headers, data=json.dumps(data))

print(f"\nStatus Code: {res.status_code}")
print(f"\nResponse Body:\n{json.dumps(res.json(), ensure_ascii=False, indent=2)}")
