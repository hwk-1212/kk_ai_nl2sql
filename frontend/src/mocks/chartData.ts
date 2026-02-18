import type { ChartConfig } from '@/types'

export const barChartConfig: ChartConfig = {
  chartType: 'bar',
  title: '各品类销售总额',
  xAxis: { field: 'category', label: '品类' },
  yAxis: { field: 'total', label: '销售额 (元)' },
  series: [{ field: 'total', label: '销售额', color: '#34d399' }],
  data: [
    { category: '电子产品', total: 125000 },
    { category: '服装', total: 98000 },
    { category: '食品', total: 76000 },
    { category: '家居', total: 63000 },
    { category: '美妆', total: 54000 },
    { category: '运动', total: 42000 },
    { category: '图书', total: 31000 },
    { category: '玩具', total: 22000 },
  ],
}

export const lineChartConfig: ChartConfig = {
  chartType: 'line',
  title: '月度销售趋势',
  xAxis: { field: 'month', label: '月份' },
  yAxis: { field: 'revenue', label: '营收 (万元)' },
  series: [
    { field: 'revenue', label: '营收', color: '#60a5fa' },
    { field: 'cost', label: '成本', color: '#f472b6' },
  ],
  data: [
    { month: '1月', revenue: 42, cost: 28 },
    { month: '2月', revenue: 38, cost: 25 },
    { month: '3月', revenue: 51, cost: 30 },
    { month: '4月', revenue: 47, cost: 29 },
    { month: '5月', revenue: 55, cost: 32 },
    { month: '6月', revenue: 63, cost: 35 },
    { month: '7月', revenue: 59, cost: 33 },
    { month: '8月', revenue: 68, cost: 37 },
    { month: '9月', revenue: 72, cost: 40 },
    { month: '10月', revenue: 81, cost: 44 },
    { month: '11月', revenue: 95, cost: 50 },
    { month: '12月', revenue: 110, cost: 55 },
  ],
}

export const pieChartConfig: ChartConfig = {
  chartType: 'pie',
  title: '客户来源分布',
  series: [{ field: 'value', label: '占比' }],
  data: [
    { name: '自然搜索', value: 35 },
    { name: '社交媒体', value: 25 },
    { name: '直接访问', value: 20 },
    { name: '邮件营销', value: 12 },
    { name: '广告投放', value: 8 },
  ],
}

export const mockChartConfigs: ChartConfig[] = [
  barChartConfig,
  lineChartConfig,
  pieChartConfig,
]
