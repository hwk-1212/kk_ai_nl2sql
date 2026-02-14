"""
测试3: DeepSeek-Chat 流式输出（普通模式 + 思考模式）
- 模型: deepseek-chat (v3.2)
- 模式: stream=True，分别测试普通和思考模式
- 目的: 记录每个 chunk 的字段结构，区分 reasoning_content 和 content
"""
import json
import time
from openai import OpenAI

API_KEY = "sk-360507b80072494caebb32e290bef60c"
BASE_URL = "https://api.deepseek.com"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)


def test_stream_normal():
    """3a: 流式 - 普通对话模式"""
    print("=" * 80)
    print("测试3a: 流式输出 - 普通对话模式 (deepseek-chat)")
    print("=" * 80)

    messages = [
        {"role": "user", "content": "用两句话介绍Python语言"},
    ]

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        stream=True,
    )

    content = ""
    chunk_count = 0
    first_chunk_raw = None
    last_chunk_raw = None

    for chunk in response:
        chunk_count += 1
        chunk_dict = chunk.model_dump()

        # 保存首尾 chunk
        if chunk_count == 1:
            first_chunk_raw = chunk_dict
        last_chunk_raw = chunk_dict

        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            content += delta.content
            print(delta.content, end="", flush=True)

    print("\n")

    print(f"--- 总 chunk 数: {chunk_count} ---")
    print(f"\n--- 第一个 chunk (raw) ---")
    print(json.dumps(first_chunk_raw, indent=2, ensure_ascii=False))
    print(f"\n--- 最后一个 chunk (raw) ---")
    print(json.dumps(last_chunk_raw, indent=2, ensure_ascii=False))
    print(f"\n--- 完整 content ---\n{content}")

    # 检查 chunk delta 的字段
    if first_chunk_raw and first_chunk_raw.get("choices"):
        delta_keys = list(first_chunk_raw["choices"][0].get("delta", {}).keys())
        print(f"\nchunk.choices[0].delta 字段: {delta_keys}")


def test_stream_thinking():
    """3b: 流式 - 思考模式"""
    print("\n" + "=" * 80)
    print("测试3b: 流式输出 - 思考模式 (deepseek-chat + thinking)")
    print("=" * 80)

    messages = [
        {"role": "user", "content": "strawberry 这个单词里有几个 r？"},
    ]

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        stream=True,
        extra_body={"thinking": {"type": "enabled"}},
    )

    reasoning_content = ""
    content = ""
    chunk_count = 0
    first_chunk_raw = None
    reasoning_done = False
    transition_chunk_raw = None  # reasoning -> content 切换的 chunk

    print("\n[Reasoning 阶段]")
    for chunk in response:
        chunk_count += 1
        chunk_dict = chunk.model_dump()

        if chunk_count == 1:
            first_chunk_raw = chunk_dict

        if not chunk.choices:
            continue

        delta = chunk.choices[0].delta
        delta_dict = delta.model_dump() if delta else {}

        # 检查 reasoning_content 字段
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

    print(f"\n--- 完整 reasoning_content ---\n{reasoning_content[:500]}{'...' if len(reasoning_content) > 500 else ''}")
    print(f"\n--- 完整 content ---\n{content}")

    # 列出 delta 中所有出现过的字段
    print(f"\nchunk.choices[0].delta 字段 (first chunk): {list(first_chunk_raw['choices'][0]['delta'].keys()) if first_chunk_raw else 'N/A'}")


if __name__ == "__main__":
    test_stream_normal()
    print("\n\n")
    test_stream_thinking()

    print("\n" + "=" * 80)
    print("测试3 全部完成")
    print("=" * 80)
