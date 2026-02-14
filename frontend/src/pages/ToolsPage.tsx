import { useEffect, useState } from 'react'
import { useToolStore, type ToolItem } from '@/stores/toolStore'
import {
  Wrench, Globe, Plus, Trash2, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Zap, Code2, Link, TestTube,
  Loader2, CheckCircle, XCircle,
} from 'lucide-react'

// ======================== 创建工具表单 ========================

function CreateToolForm({ onClose }: { onClose: () => void }) {
  const createTool = useToolStore((s) => s.createTool)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [httpUrl, setHttpUrl] = useState('')
  const [httpMethod, setHttpMethod] = useState('POST')
  const [headers, setHeaders] = useState('')
  const [bodyTemplate, setBodyTemplate] = useState('')
  const [paramsJson, setParamsJson] = useState('{\n  "type": "object",\n  "properties": {\n    "query": {\n      "type": "string",\n      "description": "查询参数"\n    }\n  },\n  "required": ["query"]\n}')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim() || !httpUrl.trim()) {
      setError('名称和 URL 不能为空')
      return
    }
    let params: Record<string, unknown> = {}
    try {
      params = JSON.parse(paramsJson)
    } catch {
      setError('参数 Schema JSON 格式错误')
      return
    }
    let headersObj: Record<string, string> = {}
    if (headers.trim()) {
      try {
        headersObj = JSON.parse(headers)
      } catch {
        setError('Headers JSON 格式错误')
        return
      }
    }

    setSubmitting(true)
    setError('')
    try {
      await createTool({
        name: name.trim(),
        description: description.trim(),
        tool_type: 'http',
        parameters: params,
        http_url: httpUrl.trim(),
        http_method: httpMethod,
        http_headers: headersObj,
        http_body_template: bodyTemplate,
      })
      onClose()
    } catch (e: any) {
      setError(e.message || 'Failed to create tool')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white">创建自定义工具</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">工具名称 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my_api_tool"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">HTTP 方法</label>
          <select
            value={httpMethod}
            onChange={(e) => setHttpMethod(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">描述</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="这个工具做什么..."
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">HTTP URL *</label>
        <input
          value={httpUrl}
          onChange={(e) => setHttpUrl(e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">参数 Schema (JSON Schema)</label>
        <textarea
          value={paramsJson}
          onChange={(e) => setParamsJson(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Headers (JSON, 可选)
        </label>
        <input
          value={headers}
          onChange={(e) => setHeaders(e.target.value)}
          placeholder='{"Authorization": "Bearer xxx"}'
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">
          Body 模板 (可选, 用 {'{{key}}'} 占位符)
        </label>
        <textarea
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          rows={3}
          placeholder='{"query": "{{query}}", "limit": 10}'
          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-gradient text-white px-6 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {submitting ? '创建中...' : '创建工具'}
        </button>
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          取消
        </button>
      </div>
    </div>
  )
}

// ======================== 工具卡片 ========================

function ToolCard({ tool }: { tool: ToolItem }) {
  const { toggleTool, deleteTool, testTool, toggleBuiltin } = useToolStore()
  const [expanded, setExpanded] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; result?: string; error?: string } | null>(null)

  const isBuiltin = tool.source === 'builtin'
  const isCustom = tool.source === 'custom'

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testTool(tool.id)
      setTestResult(r)
    } catch (e: any) {
      setTestResult({ success: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isBuiltin
            ? 'bg-blue-50 dark:bg-blue-500/10'
            : 'bg-green-50 dark:bg-green-500/10'
        }`}>
          {isBuiltin ? (
            <Zap size={20} className="text-blue-500" />
          ) : (
            <Link size={20} className="text-green-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-white text-sm">{tool.name}</span>
            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
              isBuiltin
                ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10'
                : 'bg-green-50 text-green-500 dark:bg-green-500/10'
            }`}>
              {isBuiltin ? '内置' : 'HTTP'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{tool.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (isBuiltin) toggleBuiltin(tool.name)
              else toggleTool(tool.id)
            }}
            className={`${tool.enabled ? 'text-primary' : 'text-slate-400'}`}
          >
            {tool.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
          {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
          {isCustom && tool.http_url && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Endpoint</span>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                {tool.http_method} {tool.http_url}
              </p>
            </div>
          )}

          {tool.parameters && Object.keys((tool.parameters as any)?.properties || {}).length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Parameters</span>
              <pre className="text-xs font-mono bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 mt-1 overflow-x-auto text-slate-600 dark:text-slate-300">
                {JSON.stringify(tool.parameters, null, 2)}
              </pre>
            </div>
          )}

          {isCustom && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleTest}
                disabled={testing}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-primary transition-colors"
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <TestTube size={12} />}
                测试
              </button>
              <button
                onClick={() => { if (confirm('确定删除此工具?')) deleteTool(tool.id) }}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} />
                删除
              </button>
            </div>
          )}

          {testResult && (
            <div className={`rounded-lg p-3 text-xs ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-500/5 border border-green-200 dark:border-green-500/20'
                : 'bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20'
            }`}>
              <div className="flex items-center gap-1 mb-1">
                {testResult.success
                  ? <CheckCircle size={12} className="text-green-500" />
                  : <XCircle size={12} className="text-red-500" />
                }
                <span className={`font-medium ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? '成功' : '失败'}
                </span>
              </div>
              <pre className="font-mono text-[11px] whitespace-pre-wrap break-all text-slate-600 dark:text-slate-300">
                {testResult.result || testResult.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ======================== 主页面 ========================

export default function ToolsPage() {
  const { tools, loading, loadTools } = useToolStore()
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadTools()
  }, [loadTools])

  const builtinTools = tools.filter((t) => t.source === 'builtin')
  const customTools = tools.filter((t) => t.source === 'custom')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">工具管理</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            管理 AI 可用的内置工具和自定义 HTTP 工具
          </p>
        </div>

        {/* 内置工具 */}
        <section>
          <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">
            内置工具
          </h2>
          {builtinTools.length === 0 && !loading ? (
            <p className="text-sm text-slate-400">暂无内置工具</p>
          ) : (
            <div className="space-y-2">
              {builtinTools.map((t) => (
                <ToolCard key={t.id} tool={t} />
              ))}
            </div>
          )}
        </section>

        {/* 自定义工具 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              自定义工具
            </h2>
            {!showCreate && (
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <Plus size={16} />
                创建工具
              </button>
            )}
          </div>

          {showCreate && (
            <div className="mb-4">
              <CreateToolForm onClose={() => { setShowCreate(false); loadTools() }} />
            </div>
          )}

          {customTools.length === 0 && !showCreate ? (
            <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
              <Code2 size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-2">还没有自定义工具</p>
              <p className="text-xs text-slate-400 dark:text-slate-600 mb-4">
                创建 HTTP 工具让 AI 调用你的 API
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="btn-gradient text-white px-5 py-2 rounded-xl text-sm font-semibold"
              >
                创建第一个工具
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {customTools.map((t) => (
                <ToolCard key={t.id} tool={t} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
