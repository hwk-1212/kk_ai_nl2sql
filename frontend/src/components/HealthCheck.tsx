import { useEffect, useState, useCallback } from 'react'
import { CheckCircle, XCircle, RefreshCw, Server } from 'lucide-react'
const checkHealth = async () => {
  const res = await fetch('/api/v1/health')
  return res.json()
}
import type { HealthResponse } from '../types'

export default function HealthCheck() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await checkHealth()
      setHealth(data)
    } catch (e: any) {
      setError(e.message || 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  const serviceIcons: Record<string, string> = {
    postgresql: '🐘',
    redis: '🔴',
    milvus: '🧠',
    minio: '📦',
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">KK GPT AIBot</h1>
          <p className="text-slate-400">System Health Dashboard</p>
        </div>

        {/* Status Card */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
          {/* Top Status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Server className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-400">
                {health ? `v${health.version}` : '...'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {health && (
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    health.status === 'healthy'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {health.status.toUpperCase()}
                </span>
              )}
              <button
                onClick={fetchHealth}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              Connection failed: {error}
            </div>
          )}

          {/* Services */}
          {health && (
            <div className="space-y-3">
              {Object.entries(health.services).map(([name, status]) => (
                <div
                  key={name}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{serviceIcons[name] || '⚙️'}</span>
                    <span className="text-sm font-medium text-slate-200 capitalize">{name}</span>
                  </div>
                  {status === 'ok' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5 text-red-400" />
                      <span className="text-xs text-red-400 max-w-[120px] truncate">{status}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          {health && (
            <p className="text-xs text-slate-500 mt-4 text-center">
              Last checked: {new Date(health.timestamp).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
