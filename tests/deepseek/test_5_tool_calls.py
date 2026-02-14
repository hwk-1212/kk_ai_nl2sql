"""
测试5: DeepSeek-Chat Function Call / Tool Calls
- 模型: deepseek-chat (v3.2)
- 模式: tools + tool_choice
- 目的: 记录 tool_calls 返回字段结构，以及多轮 tool 调用流程

测试包含:
  5a: 普通模式下的 tool call
  5b: 思考模式下的 tool call (DeepSeek-V3.2 支持)
"""
import json
from openai import OpenAI

API_KEY = "sk-360507b80072494caebb32e290bef60c"
BASE_URL = "https://api.deepseek.com"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

# 定义工具
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "获取指定城市的当前天气信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "城市名称，例如：杭州、北京",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "温度单位",
                    },
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_web",
            "description": "搜索互联网获取最新信息",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "搜索关键词",
                    },
                },
                "required": ["query"],
            },
        },
    },
]


def test_tool_call_normal():
    """5a: 普通模式 - Tool Call"""
    print("=" * 80)
    print("测试5a: Tool Call - 普通模式")
    print("=" * 80)

    messages = [{"role": "user", "content": "杭州今天天气怎么样？"}]

    # --- 第一轮：模型决定调用工具 ---
    print("\n--- 第1轮: 用户提问，模型返回 tool_calls ---")
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        tools=tools,
    )

    raw = response.model_dump()
    print(json.dumps(raw, indent=2, ensure_ascii=False))

    msg = response.choices[0].message
    msg_dict = msg.model_dump()
    print(f"\nmessage 字段: {list(msg_dict.keys())}")
    print(f"  role:       {msg.role}")
    print(f"  content:    {msg.content}")
    print(f"  tool_calls: {msg.tool_calls}")

    if msg.tool_calls:
        for i, tc in enumerate(msg.tool_calls):
            tc_dict = tc.model_dump()
            print(f"\n  tool_calls[{i}] 字段: {list(tc_dict.keys())}")
            print(f"    id:       {tc.id}")
            print(f"    type:     {tc.type}")
            print(f"    function.name:      {tc.function.name}")
            print(f"    function.arguments: {tc.function.arguments}")

        # --- 第二轮：传入工具结果 ---
        print("\n--- 第2轮: 传入工具执行结果 ---")
        # 把 assistant 的 message 加入上下文
        messages.append(msg)

        # 模拟工具返回
        tool_result = json.dumps({"temperature": 24, "condition": "晴天", "humidity": "65%"})
        messages.append({
            "role": "tool",
            "tool_call_id": msg.tool_calls[0].id,
            "content": tool_result,
        })

        response2 = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            tools=tools,
        )

        raw2 = response2.model_dump()
        print(json.dumps(raw2, indent=2, ensure_ascii=False))

        print(f"\n最终回复: {response2.choices[0].message.content}")
        print(f"finish_reason: {response2.choices[0].finish_reason}")
    else:
        print("\n[WARNING] 模型未返回 tool_calls，可能直接回答了")


def test_tool_call_thinking():
    """5b: 思考模式 - Tool Call"""
    print("\n" + "=" * 80)
    print("测试5b: Tool Call - 思考模式 (deepseek-chat + thinking)")
    print("=" * 80)

    messages = [{"role": "user", "content": "帮我查一下北京和上海今天的天气，对比一下哪个更适合出行"}]

    print("\n--- 第1轮: 用户提问，思考模式 + tools ---")
    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        tools=tools,
        extra_body={"thinking": {"type": "enabled"}},
    )

    raw = response.model_dump()
    print(json.dumps(raw, indent=2, ensure_ascii=False))

    msg = response.choices[0].message
    msg_dict = msg.model_dump()
    print(f"\nmessage 字段: {list(msg_dict.keys())}")

    # 检查 reasoning_content
    if "reasoning_content" in msg_dict:
        rc = msg_dict["reasoning_content"]
        print(f"  reasoning_content: {rc[:200] if rc else 'None'}{'...' if rc and len(rc) > 200 else ''}")

    if msg.tool_calls:
        print(f"\n  tool_calls 数量: {len(msg.tool_calls)}")
        for i, tc in enumerate(msg.tool_calls):
            print(f"  tool_calls[{i}]: {tc.function.name}({tc.function.arguments})")

        # 模拟返回两个城市的天气
        messages.append(msg)
        for tc in msg.tool_calls:
            args = json.loads(tc.function.arguments)
            if "北京" in args.get("location", ""):
                result = json.dumps({"temperature": 18, "condition": "多云", "humidity": "45%"})
            else:
                result = json.dumps({"temperature": 22, "condition": "晴", "humidity": "55%"})
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

        print("\n--- 第2轮: 传入工具结果 ---")
        response2 = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            tools=tools,
            extra_body={"thinking": {"type": "enabled"}},
        )

        raw2 = response2.model_dump()
        print(json.dumps(raw2, indent=2, ensure_ascii=False))
        print(f"\n最终回复: {response2.choices[0].message.content}")
    else:
        print("\n[INFO] 模型未调用工具，直接输出了回答:")
        print(msg.content)


def test_tool_call_stream():
    """5c: 流式 - Tool Call"""
    print("\n" + "=" * 80)
    print("测试5c: Tool Call - 流式输出")
    print("=" * 80)

    messages = [{"role": "user", "content": "深圳明天天气如何？"}]

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        tools=tools,
        stream=True,
    )

    tool_calls_data = {}  # id -> {name, arguments}
    content = ""
    chunk_count = 0
    first_chunk = None

    for chunk in response:
        chunk_count += 1
        chunk_dict = chunk.model_dump()

        if chunk_count == 1:
            first_chunk = chunk_dict

        if not chunk.choices:
            continue

        delta = chunk.choices[0].delta

        # 收集 tool_calls
        if delta.tool_calls:
            for tc_delta in delta.tool_calls:
                idx = tc_delta.index
                if idx not in tool_calls_data:
                    tool_calls_data[idx] = {"id": "", "name": "", "arguments": ""}
                if tc_delta.id:
                    tool_calls_data[idx]["id"] = tc_delta.id
                if tc_delta.function:
                    if tc_delta.function.name:
                        tool_calls_data[idx]["name"] = tc_delta.function.name
                    if tc_delta.function.arguments:
                        tool_calls_data[idx]["arguments"] += tc_delta.function.arguments

        # 收集 content
        if delta.content:
            content += delta.content
            print(delta.content, end="", flush=True)

    print("\n")
    print(f"--- 总 chunk 数: {chunk_count} ---")
    print(f"\n--- 第一个 chunk (raw) ---")
    print(json.dumps(first_chunk, indent=2, ensure_ascii=False))

    if tool_calls_data:
        print(f"\n--- 流式收集到的 tool_calls ---")
        for idx, tc in tool_calls_data.items():
            print(f"  [{idx}] id={tc['id']}, name={tc['name']}, args={tc['arguments']}")
    else:
        print("\n[INFO] 流式中未收到 tool_calls")

    if content:
        print(f"\n--- content ---\n{content}")


if __name__ == "__main__":
    test_tool_call_normal()
    test_tool_call_thinking()
    test_tool_call_stream()

    print("\n" + "=" * 80)
    print("测试5 全部完成")
    print("=" * 80)
