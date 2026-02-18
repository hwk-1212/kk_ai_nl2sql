import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'
import AuthGuard from '@/components/common/AuthGuard'
import ToastContainer from '@/components/common/Toast'
import ChatPage from '@/pages/ChatPage'
import { useAuthStore } from '@/stores/authStore'

// ---- Lazy-loaded pages (code splitting) ----
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const MCPPage = lazy(() => import('@/pages/MCPPage'))
const KnowledgePage = lazy(() => import('@/pages/KnowledgePage'))
const ToolsPage = lazy(() => import('@/pages/ToolsPage'))
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'))
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'))
const UserManagementPage = lazy(() => import('@/pages/admin/UserManagementPage'))
const TenantManagementPage = lazy(() => import('@/pages/admin/TenantManagementPage'))
const BillingPage = lazy(() => import('@/pages/admin/BillingPage'))
const AuditLogsPage = lazy(() => import('@/pages/admin/AuditLogsPage'))
const DataPage = lazy(() => import('@/pages/DataPage'))
const MetricPage = lazy(() => import('@/pages/MetricPage'))
const ReportPage = lazy(() => import('@/pages/ReportPage'))
const DataPermissionPage = lazy(() => import('@/pages/DataPermissionPage'))

// 页面加载骨架
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full w-full py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">加载中…</span>
      </div>
    </div>
  )
}

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <BrowserRouter>
      <ToastContainer />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* authenticated */}
          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route index element={<ChatPage />} />
            <Route path="mcp" element={<MCPPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="tools" element={<ToolsPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="metrics" element={<MetricPage />} />
            <Route path="reports" element={<ReportPage />} />
            <Route path="data-permissions" element={<DataPermissionPage />} />

            {/* admin */}
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="users" element={<UserManagementPage />} />
              <Route path="tenants" element={<TenantManagementPage />} />
              <Route path="billing" element={<BillingPage />} />
              <Route path="logs" element={<AuditLogsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
