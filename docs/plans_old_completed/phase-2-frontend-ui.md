# Phase 2: 前端 UI 开发 (Mock Data 驱动) ✅ 已完成

## 目标

**UI 先行**，完成所有前端界面开发。全部使用 mock data 驱动，不依赖后端真实接口。后续 Phase 逐步替换 mock 为真实 API。

## 技术栈

- React 18 + TypeScript 5
- Vite 5
- Tailwind CSS 3 (darkMode: 'class')
- Zustand 状态管理
- React Router v6
- react-markdown + rehype-highlight + remark-gfm + remark-math + rehype-katex
- Lucide React 图标
- Plus Jakarta Sans 字体
- axios (预埋)

## 设计风格 (对齐 UI 设计稿)

- **主色调**: Mint Green `#4FD1C5` → `#38B2AC` 渐变
- **字体**: Plus Jakarta Sans (Google Fonts)
- **Glass Sidebar**: 半透明 + backdrop-blur
- **大圆角**: rounded-2xl / rounded-3xl / rounded-4xl
- **柔和阴影**: shadow-soft / shadow-glass
- **聊天气泡**: 用户淡蓝 `#E6F6FF`，AI 白色卡片 + 边框
- **模型选择**: Pill 切换 (快速对话 / 深度思考)
- **Thinking**: 时间轴步骤样式 (CheckCircle + 竖线)
- **MCP 卡片**: 大卡片网格 + 连接成功弹窗
- **Section Headers**: 大写 + tracking-widest + 10px font

## 页面 & 组件清单

### 2.1 整体布局

- [x] **AppLayout** — 响应式布局 (Sidebar + 主内容区)
- [x] **Sidebar** — Glass morphism 可折叠侧栏
- [x] 移动端自动收起 + overlay

### 2.2 认证页面

- [x] **LoginPage** — 邮箱 + 密码登录 (渐变 logo + 大圆角输入框)
- [x] **RegisterPage** — 注册表单 (邮箱/密码/确认密码/昵称)
- [x] **AuthGuard** — 路由守卫 (mock token 验证)

### 2.3 Sidebar

- [x] **Sidebar.tsx** — Glass 容器，渐变 logo，可折叠
- [x] **ConversationList.tsx** — 会话列表 (分组: 今天/近期)
  - 新建会话按钮 (渐变绿)
  - 会话项: 标题 + 删除/重命名
  - 当前会话高亮
  - mock 数据: 5 个假会话
- [x] **KnowledgePage** — 知识库占位页面
- [x] **UserMenu** — 底部用户卡片 + 设置/主题/退出菜单

### 2.4 聊天核心区

- [x] **ChatPage.tsx** — 聊天页面容器
- [x] **MessageList.tsx** — 消息列表 (含欢迎页)
- [x] **MessageItem.tsx** — 单条消息
  - 用户: 淡蓝气泡 (rounded-3xl rounded-tl-none)
  - AI: 白色卡片 (border + shadow-soft)
  - 操作栏: 复制 + 点赞 + 重新生成
- [x] **ChatInput.tsx** — 输入框
  - 超大圆角 textarea (rounded-4xl)
  - 渐变发送按钮
  - 文件上传 + 知识库 + 联网搜索按钮
  - SHIFT+ENTER 提示

### 2.5 Markdown 渲染

- [x] **MarkdownContent.tsx**
  - react-markdown 渲染
  - 代码块: 语法高亮 + 语言标签 + 一键复制
  - 数学公式: rehype-katex
  - GFM: 表格、任务列表、删除线
  - 链接新窗口打开

### 2.6 DeepSeek 模式专属 UI

- [x] **ModelSelector.tsx** — Pill 切换样式 (居中显示)
  - 快速对话 (DeepSeek-Chat) + 深度思考 (DeepSeek-R1)
- [x] **ThinkingBlock.tsx** — 时间轴推理过程展示
  - CheckCircle + 竖线连接
  - 最后一步: spinner 动画
  - 可折叠/展开
- [x] **StreamingIndicator** — 流式光标动画

### 2.7 工具调用展示

- [x] **ToolCallBlock.tsx** — MCP/Plugin 工具调用展示
  - 调用中/成功/失败状态
  - 折叠展开参数和结果

### 2.8 记忆系统指示

- [x] **MemoryIndicator.tsx** — 记忆片段标签 + 展开详情

### 2.9 文件上传

- [x] **FileUpload.tsx** — 拖拽上传区 + 文件列表

### 2.10 MCP 管理面板

- [x] **MCPServerList.tsx** — 大卡片网格布局 (CONNECTED/INACTIVE 状态)
- [x] **MCPRegisterForm.tsx** — 注册表单 (三列布局) + 连接成功弹窗
- [x] **MCPToolBrowser.tsx** — Server 工具列表 + Schema 展示

### 2.11 Admin 后台 (骨架)

- [x] **AdminLayout** — Glass 侧导航 + Overview/Users/Tenants/Billing/Logs
- [x] **DashboardPage** — 统计卡片 + 7 日趋势柱状图
- [x] **UserManagementPage** — 用户列表表格 + 角色徽章
- [x] **TenantManagementPage** — 租户卡片网格
- [x] **BillingPage** — 用量统计表格
- [x] **AuditLogsPage** — 审计日志时间线

### 2.12 公共组件

- [x] **Toast** — 全局提示 (白色卡片 + glass shadow)
- [x] **Modal** — 通用弹窗 (大圆角 + backdrop-blur)
- [x] **Loading** — 加载状态
- [x] **EmptyState** — 空状态占位

## 状态管理 (Zustand Stores)

- [x] `authStore` — user, token, isAuthenticated, login/register/logout (mock)
- [x] `chatStore` — conversations[], currentId, selectedModel, isStreaming, streamingContent/Reasoning, sendMessage, stopStreaming, regenerate
- [x] `mcpStore` — servers[], selectedServerId, toggleServer, addServer, removeServer
- [x] `uiStore` — theme, sidebarOpen, isMobile, rightPanel

## Mock 数据

- [x] `src/mocks/conversations.ts` — 5 个假会话 + 消息 (含代码块、表格、LaTeX)
- [x] `src/mocks/models.ts` — DeepSeek-R1 (深度思考), DeepSeek-Chat (快速对话)
- [x] `src/mocks/mcpServers.ts` — 3 个假 Server (Web Search, File System, Database Query)
- [x] `src/mocks/streaming.ts` — 模拟流式输出 (reasoning 15ms/char + content 10ms/char, 支持 abort)
- [x] `src/mocks/memory.ts` — 3 条假记忆片段

## 验证标准

- [x] 所有页面路由可正常访问 (/, /login, /register, /mcp, /knowledge, /admin/*)
- [x] Chat UI 完整: Sidebar + 消息列表 + 输入框 + 模型选择
- [x] Mock 流式输出正常工作 (逐字显示 + thinking 折叠)
- [x] DeepSeek 推理模式: ThinkingBlock 可折叠展开，时间轴动画
- [x] DeepSeek 对话模式: 无 ThinkingBlock，直接流式内容
- [x] Markdown 渲染: 代码高亮 + 复制 + LaTeX + 表格
- [x] 文件上传 UI 交互正常
- [x] MCP 管理面板各交互正常 (mock) + 连接成功弹窗
- [x] 响应式: 移动端 Sidebar 自动收起
- [x] 深色/浅色主题切换 (UserMenu 内)
- [x] TypeScript 编译 0 error
- [x] Vite build 成功
- [x] Docker 部署验证通过 (10 容器全部 healthy)

## 完成记录

- **完成时间**: 2026-02-11
- **源文件数**: 46 个 (.tsx/.ts)
- **新增依赖**: zustand, react-router-dom, react-markdown, rehype-highlight, rehype-katex, remark-gfm, remark-math, katex
- **UI 美化**: 对齐设计稿 (5 张: 对话界面、Admin、知识库、MCP 弹窗、来源对比)
- **设计系统**: Plus Jakarta Sans 字体 + Mint Green 渐变主色 + Glass morphism + 大圆角
