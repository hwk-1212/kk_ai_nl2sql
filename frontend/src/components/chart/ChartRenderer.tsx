import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  AreaChart, Area,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ChartConfig } from '@/types'
import DataTable from './DataTable'

interface ChartRendererProps {
  config: ChartConfig
  height?: number
  className?: string
}

const COLORS = ['#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24', '#fb923c']

export default function ChartRenderer({ config, height = 300, className = '' }: ChartRendererProps) {
  const { chartType, title, xAxis, yAxis, series, data } = config
  const safeData = Array.isArray(data) ? data : []

  if (chartType === 'table') {
    return (
      <div className={className}>
        {title && <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{title}</h4>}
        <DataTable data={safeData} />
      </div>
    )
  }

  const xField = xAxis?.field || (safeData.length > 0 ? Object.keys(safeData[0])[0] : 'x')
  const seriesFields = series?.map((s) => s.field) || (
    safeData.length > 0 ? Object.keys(safeData[0]).filter((k) => k !== xField) : []
  )
  const seriesLabels = series?.reduce<Record<string, string>>((acc, s) => {
    if (s.label) acc[s.field] = s.label
    return acc
  }, {}) || {}
  const seriesColors = series?.reduce<Record<string, string>>((acc, s, i) => {
    acc[s.field] = s.color || COLORS[i % COLORS.length]
    return acc
  }, {}) || {}

  const getColor = (field: string, i: number) => seriesColors[field] || COLORS[i % COLORS.length]

  const commonAxisProps = {
    tick: { fontSize: 12, fill: '#94a3b8' },
    axisLine: { stroke: '#e2e8f0' },
    tickLine: false,
  }

  if (safeData.length === 0) {
    return (
      <div className={`flex items-center justify-center text-slate-400 text-sm ${className}`} style={{ height }}>
        暂无数据
      </div>
    )
  }

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xField} {...commonAxisProps} label={xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5, fontSize: 12, fill: '#64748b' } : undefined} />
            <YAxis {...commonAxisProps} label={yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft', fontSize: 12, fill: '#64748b' } : undefined} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
            <Legend />
            {seriesFields.map((f, i) => (
              <Bar key={f} dataKey={f} name={seriesLabels[f] || f} fill={getColor(f, i)} radius={[6, 6, 0, 0]} />
            ))}
          </BarChart>
        )

      case 'line':
        return (
          <LineChart data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xField} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
            <Legend />
            {seriesFields.map((f, i) => (
              <Line key={f} type="monotone" dataKey={f} name={seriesLabels[f] || f} stroke={getColor(f, i)} strokeWidth={2} dot={{ r: 4, fill: getColor(f, i) }} activeDot={{ r: 6 }} />
            ))}
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xField} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
            <Legend />
            {seriesFields.map((f, i) => (
              <Area key={f} type="monotone" dataKey={f} name={seriesLabels[f] || f} stroke={getColor(f, i)} fill={getColor(f, i)} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        )

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={safeData}
              dataKey={seriesFields[0] || 'value'}
              nameKey={xField}
              cx="50%"
              cy="50%"
              outerRadius={height / 3}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#94a3b8' }}
            >
              {safeData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
            <Legend />
          </PieChart>
        )

      case 'scatter':
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xField} {...commonAxisProps} name={xAxis?.label || xField} />
            <YAxis dataKey={seriesFields[0] || 'y'} {...commonAxisProps} name={yAxis?.label || seriesFields[0]} />
            <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name={title || 'Data'} data={safeData} fill={COLORS[0]} />
          </ScatterChart>
        )

      default:
        return null
    }
  }

  return (
    <div className={className}>
      {title && <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{title}</h4>}
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()!}
      </ResponsiveContainer>
    </div>
  )
}
