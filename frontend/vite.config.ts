import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 生产构建优化
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心单独打包 (缓存友好)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI 库
          'vendor-ui': ['lucide-react', 'zustand'],
          // Markdown 渲染 (较大)
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-katex', 'remark-math', 'katex'],
        },
      },
    },
    // 超过 500KB 发出警告
    chunkSizeWarningLimit: 500,
  },
})
