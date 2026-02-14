"""MemOS API 测试 6: 删除记忆 (delete/memory)
注意: 需要先从 test_2 的返回结果中获取真实的 memory_id 填入
"""
import requests
import json

MEMOS_API_KEY = "mpg-Ka3hih7B9/CMpw0KYlF5vC0DhTUERuuAEpUvlfYg"
MEMOS_BASE_URL = "https://memos.memtensor.cn/api/openmem/v1"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Token {MEMOS_API_KEY}",
}

# 占位符 — 运行时从前面的搜索结果中拿真实 ID 替换
MEMORY_ID = "843c0345-1d0d-40a3-ad9c-bd623ec79189"

data = {
    "memory_ids": [MEMORY_ID],
}

url = f"{MEMOS_BASE_URL}/delete/memory"

print("=" * 60)
print("TEST 6: 删除记忆 (delete/memory)")
print(f"URL: {url}")
print(f"Request Body:\n{json.dumps(data, ensure_ascii=False, indent=2)}")
print("=" * 60)

res = requests.post(url=url, headers=headers, data=json.dumps(data))

print(f"\nStatus Code: {res.status_code}")
print(f"\nResponse Body:\n{json.dumps(res.json(), ensure_ascii=False, indent=2)}")
