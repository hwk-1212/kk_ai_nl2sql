"""
测试3: 千问 qwen-plus 深度思考模式（流式）
- 模型: qwen-plus
- 模式: extra_body={"enable_thinking": True} + stream
- 目的: 记录 reasoning_content 字段结构，与 DeepSeek 对比
"""
import json
from openai import OpenAI

API_KEY = "sk-ee882ade795e46c1afc5fb1600439484"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)


def test_thinking_stream():
    """3a: 流式 - 深度思考模式"""
    print("=" * 80)
    print("测试3a: 千问 qwen-plus 深度思考（流式）")
    print("=" * 80)

    messages = [
        {"role": "user", "content": "strawberry 这个单词里有几个 r？"},
    ]

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=messages,
        stream=True,
        extra_body={"enable_thinking": True},
        stream_options={"include_usage": True},
    )

    reasoning_content = ""
    content = ""
    chunk_count = 0
    first_chunk_raw = None
    reasoning_done = False
    transition_chunk_raw = None
    usage_chunk_raw = None

    print("\n[Reasoning 阶段]")
    for chunk in response:
        chunk_count += 1
        chunk_dict = chunk.model_dump()

        if chunk_count == 1:
            first_chunk_raw = chunk_dict

        if not chunk.choices:
            # 可能是 usage-only chunk
            if chunk.usage:
                usage_chunk_raw = chunk_dict
            continue

        delta = chunk.choices[0].delta
        delta_dict = delta.model_dump() if delta else {}

        rc = delta_dict.get("reasoning_content")
        c = delta_dict.get("content")

        if rc:
            reasoning_content += rc
            print(rc, end="", flush=True)
        elif c:
            if not reasoning_done:
                reasoning_done = True
                transition_chunk_raw = chunk_dict
                print("\n\n[Content 阶段]")
            content += c
            print(c, end="", flush=True)

    print("\n")

    print(f"--- 总 chunk 数: {chunk_count} ---")
    print(f"--- reasoning_content 长度: {len(reasoning_content)} 字符 ---")
    print(f"--- content 长度: {len(content)} 字符 ---")

    print(f"\n--- 第一个 chunk (raw) ---")
    print(json.dumps(first_chunk_raw, indent=2, ensure_ascii=False))

    if transition_chunk_raw:
        print(f"\n--- 切换点 chunk (reasoning->content) ---")
        print(json.dumps(transition_chunk_raw, indent=2, ensure_ascii=False))

    if usage_chunk_raw:
        print(f"\n--- usage chunk (raw) ---")
        print(json.dumps(usage_chunk_raw, indent=2, ensure_ascii=False))

    print(f"\n--- 完整 reasoning_content ---\n{reasoning_content[:500]}{'...' if len(reasoning_content) > 500 else ''}")
    print(f"\n--- 完整 content ---\n{content}")


def test_thinking_non_stream():
    """3b: 非流式 - 深度思考模式"""
    print("\n" + "=" * 80)
    print("测试3b: 千问 qwen-plus 深度思考（非流式）")
    print("=" * 80)

    messages = [
        {"role": "user", "content": "9.11 和 9.8 哪个大？"},
    ]

    response = client.chat.completions.create(
        model="qwen-plus",
        messages=messages,
        extra_body={"enable_thinking": True},
    )

    raw = response.model_dump()
    print("\n--- 原始响应 (raw JSON) ---")
    print(json.dumps(raw, indent=2, ensure_ascii=False))

    msg = response.choices[0].message
    msg_dict = msg.model_dump()
    print(f"\nmessage 全部字段: {list(msg_dict.keys())}")
    print(f"  role:    {msg.role}")
    print(f"  content: {msg.content}")

    if "reasoning_content" in msg_dict:
        rc = msg_dict["reasoning_content"]
        print(f"  reasoning_content: {rc[:300] if rc else 'None'}{'...' if rc and len(rc) > 300 else ''}")

    usage = response.usage.model_dump()
    print(f"\nusage 全部字段: {list(usage.keys())}")
    for k, v in usage.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    test_thinking_stream()
    test_thinking_non_stream()

    print("\n" + "=" * 80)
    print("测试3 全部完成")
    print("=" * 80)
