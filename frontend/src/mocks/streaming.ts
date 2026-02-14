const MOCK_REASONING = `让我分析一下用户的问题...

首先需要理解问题的核心诉求：
1. 用户在询问一个技术问题
2. 需要给出具体的代码示例
3. 解释背后的原理

考虑几种不同的方案：
- 方案A: 直接给出解决方案
- 方案B: 先分析原因再给方案
- 方案C: 对比多种方案

综合考虑，方案B最适合，因为理解原因更重要。

让我组织一下回答的结构...`

const MOCK_CONTENT = `这是一个很好的问题！让我详细解释一下。

## 核心思路

在处理这类问题时，关键在于理解**底层原理**而不仅仅是记住 API。

### 代码示例

\`\`\`python
import asyncio
from typing import AsyncGenerator

async def stream_response() -> AsyncGenerator[str, None]:
    """模拟流式响应生成器"""
    chunks = ["Hello", " World", "!", " This", " is", " streaming", "."]
    for chunk in chunks:
        await asyncio.sleep(0.1)
        yield chunk

async def main():
    async for chunk in stream_response():
        print(chunk, end="", flush=True)
    print()

asyncio.run(main())
\`\`\`

### 关键要点

1. **异步生成器** — 使用 \`async def\` + \`yield\` 组合
2. **背压控制** — 消费者速度决定生产速度
3. **错误处理** — 需要在生成器内部 try/except

> 💡 **提示**: 在 FastAPI 中可以直接使用 \`StreamingResponse\` 配合异步生成器。

### 性能对比

| 方式 | 首字节延迟 | 内存占用 | 适用场景 |
|------|-----------|---------|---------|
| 一次性返回 | 高 | 高 | 短响应 |
| 流式返回 | 低 | 低 | 长文本 / LLM |
| WebSocket | 低 | 中 | 双向通信 |

数学公式示例：时间复杂度为 $O(n \\log n)$，空间复杂度为 $O(n)$。

$$\\sum_{i=1}^{n} \\frac{1}{i} \\approx \\ln(n) + \\gamma$$

希望这能帮到你！如果有更具体的场景，我可以进一步细化方案。`

const MOCK_SIMPLE_CONTENT = `好的，这是一个直接的回答。

### 解决方案

\`\`\`typescript
const greeting = (name: string): string => {
  return \`Hello, \${name}!\`
}

console.log(greeting("World"))
\`\`\`

这段代码使用了 TypeScript 的箭头函数语法，类型注解确保了参数和返回值的类型安全。

- **类型推断** — TS 编译器会自动推断
- **模板字符串** — 使用反引号实现字符串插值
- **箭头函数** — 简洁的函数声明方式`

interface SimulateOptions {
  isReasoner: boolean
  signal: AbortSignal
  onReasoning: (chunk: string) => void
  onContent: (chunk: string) => void
}

export async function simulateStream(opts: SimulateOptions): Promise<void> {
  const { isReasoner, signal, onReasoning, onContent } = opts
  const delay = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, ms)
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      })
    })

  // reasoning phase (only for reasoner model)
  if (isReasoner) {
    const chars = MOCK_REASONING.split('')
    for (const ch of chars) {
      await delay(15)
      onReasoning(ch)
    }
    await delay(300)
  }

  // content phase
  const content = isReasoner ? MOCK_CONTENT : MOCK_SIMPLE_CONTENT
  const chars = content.split('')
  for (const ch of chars) {
    await delay(10)
    onContent(ch)
  }
}
