"""MemOS API 测试 1: 添加记忆 (add/message)"""
import requests
import json

MEMOS_API_KEY = "mpg-Ka3hih7B9/CMpw0KYlF5vC0DhTUERuuAEpUvlfYg"
MEMOS_BASE_URL = "https://memos.memtensor.cn/api/openmem/v1"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Token {MEMOS_API_KEY}",
}

data = {
    "user_id": "kk_gpt_test_user_001",
    "conversation_id": "conv_test_0211_01",
    "messages": [
        {"role": "user", "content": "我暑假定好去广州旅游，住宿的话有哪些连锁酒店可选？"},
        {"role": "assistant", "content": "您可以考虑【七天、全季、希尔顿】等等"},
        {"role": "user", "content": "我选七天"},
        {"role": "assistant", "content": "好的，有其他问题再问我。"},
    ],
}

url = f"{MEMOS_BASE_URL}/add/message"

print("=" * 60)
print("TEST 1: 添加记忆 (add/message)")
print(f"URL: {url}")
print(f"Request Body:\n{json.dumps(data, ensure_ascii=False, indent=2)}")
print("=" * 60)

res = requests.post(url=url, headers=headers, data=json.dumps(data))

print(f"\nStatus Code: {res.status_code}")
print(f"Response Headers: {dict(res.headers)}")
print(f"\nResponse Body:\n{json.dumps(res.json(), ensure_ascii=False, indent=2)}")
