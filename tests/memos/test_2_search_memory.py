"""MemOS API 测试 2: 检索记忆 (search/memory)"""
import requests
import json

MEMOS_API_KEY = "mpg-Ka3hih7B9/CMpw0KYlF5vC0DhTUERuuAEpUvlfYg"
MEMOS_BASE_URL = "https://memos.memtensor.cn/api/openmem/v1"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Token {MEMOS_API_KEY}",
}

data = {
    "query": "我国庆想出去玩，帮我推荐个没去过的城市，以及没住过的酒店品牌",
    "user_id": "kk_gpt_test_user_001",
    "conversation_id": "conv_test_0211_02",
}

url = f"{MEMOS_BASE_URL}/search/memory"

print("=" * 60)
print("TEST 2: 检索记忆 (search/memory)")
print(f"URL: {url}")
print(f"Request Body:\n{json.dumps(data, ensure_ascii=False, indent=2)}")
print("=" * 60)

res = requests.post(url=url, headers=headers, data=json.dumps(data))

print(f"\nStatus Code: {res.status_code}")
print(f"\nResponse Body:\n{json.dumps(res.json(), ensure_ascii=False, indent=2)}")
