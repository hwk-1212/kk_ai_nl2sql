import type { DataSource, DataTable, TableDataPage } from '@/types'

export const MOCK_DATA_SOURCES: DataSource[] = [
  {
    id: 'ds-001',
    userId: 'user-001',
    name: '销售数据2024',
    sourceType: 'excel',
    originalFilename: '销售数据2024.xlsx',
    fileSize: 2_458_624,
    tableCount: 3,
    status: 'ready',
    createdAt: '2026-01-15T08:30:00Z',
    updatedAt: '2026-01-15T08:31:22Z',
  },
  {
    id: 'ds-002',
    userId: 'user-001',
    name: '客户信息',
    sourceType: 'csv',
    originalFilename: '客户信息.csv',
    fileSize: 524_288,
    tableCount: 1,
    status: 'ready',
    createdAt: '2026-02-01T14:20:00Z',
    updatedAt: '2026-02-01T14:20:45Z',
  },
  {
    id: 'ds-003',
    userId: 'user-001',
    name: '产品库存',
    sourceType: 'sqlite',
    originalFilename: '产品库存.sqlite',
    fileSize: 1_048_576,
    tableCount: 2,
    status: 'processing',
    createdAt: '2026-02-18T09:00:00Z',
    updatedAt: '2026-02-18T09:00:00Z',
  },
]

export const MOCK_DATA_TABLES: DataTable[] = [
  // ds-001: 销售数据2024.xlsx — 3 tables
  {
    id: 'tbl-001',
    dataSourceId: 'ds-001',
    userId: 'user-001',
    pgSchema: 'ds_001',
    pgTableName: 'monthly_sales',
    displayName: '月度销售汇总',
    description: '按月份统计的销售金额和订单数量',
    columnSchema: [
      { name: 'id', type: 'int4', nullable: false, comment: '主键' },
      { name: 'month', type: 'date', nullable: false, comment: '月份' },
      { name: 'region', type: 'varchar', nullable: false, comment: '销售区域' },
      { name: 'total_amount', type: 'float8', nullable: false, comment: '销售总额' },
      { name: 'order_count', type: 'int4', nullable: false, comment: '订单数' },
      { name: 'avg_price', type: 'float8', nullable: true, comment: '平均单价' },
      { name: 'is_target_met', type: 'bool', nullable: false, comment: '是否达标' },
      { name: 'updated_at', type: 'timestamp', nullable: false, comment: '更新时间' },
    ],
    rowCount: 156,
    isWritable: true,
    createdAt: '2026-01-15T08:31:00Z',
    updatedAt: '2026-01-15T08:31:00Z',
  },
  {
    id: 'tbl-002',
    dataSourceId: 'ds-001',
    userId: 'user-001',
    pgSchema: 'ds_001',
    pgTableName: 'sales_detail',
    displayName: '销售明细',
    description: '每笔销售订单的详细信息',
    columnSchema: [
      { name: 'order_id', type: 'varchar', nullable: false, comment: '订单编号' },
      { name: 'product_name', type: 'varchar', nullable: false, comment: '产品名称' },
      { name: 'quantity', type: 'int4', nullable: false, comment: '数量' },
      { name: 'unit_price', type: 'float8', nullable: false, comment: '单价' },
      { name: 'total_price', type: 'float8', nullable: false, comment: '总价' },
      { name: 'sale_date', type: 'date', nullable: false, comment: '销售日期' },
      { name: 'salesperson', type: 'varchar', nullable: true, comment: '销售员' },
    ],
    rowCount: 2340,
    isWritable: true,
    createdAt: '2026-01-15T08:31:10Z',
    updatedAt: '2026-01-15T08:31:10Z',
  },
  {
    id: 'tbl-003',
    dataSourceId: 'ds-001',
    userId: 'user-001',
    pgSchema: 'ds_001',
    pgTableName: 'sales_target',
    displayName: '销售目标',
    columnSchema: [
      { name: 'id', type: 'int4', nullable: false, comment: '主键' },
      { name: 'region', type: 'varchar', nullable: false, comment: '区域' },
      { name: 'year', type: 'int4', nullable: false, comment: '年度' },
      { name: 'quarter', type: 'int4', nullable: false, comment: '季度' },
      { name: 'target_amount', type: 'float8', nullable: false, comment: '目标金额' },
      { name: 'actual_amount', type: 'float8', nullable: true, comment: '实际金额' },
    ],
    rowCount: 48,
    isWritable: true,
    createdAt: '2026-01-15T08:31:20Z',
    updatedAt: '2026-01-15T08:31:20Z',
  },
  // ds-002: 客户信息.csv — 1 table
  {
    id: 'tbl-004',
    dataSourceId: 'ds-002',
    userId: 'user-001',
    pgSchema: 'ds_002',
    pgTableName: 'customers',
    displayName: '客户列表',
    description: '所有客户的基本信息和联系方式',
    columnSchema: [
      { name: 'customer_id', type: 'varchar', nullable: false, comment: '客户编号' },
      { name: 'company_name', type: 'varchar', nullable: false, comment: '公司名称' },
      { name: 'contact_name', type: 'varchar', nullable: false, comment: '联系人' },
      { name: 'phone', type: 'varchar', nullable: true, comment: '电话' },
      { name: 'email', type: 'varchar', nullable: true, comment: '邮箱' },
      { name: 'city', type: 'varchar', nullable: false, comment: '城市' },
      { name: 'is_vip', type: 'bool', nullable: false, comment: 'VIP客户' },
      { name: 'created_at', type: 'timestamp', nullable: false, comment: '注册时间' },
    ],
    rowCount: 580,
    isWritable: true,
    createdAt: '2026-02-01T14:20:30Z',
    updatedAt: '2026-02-01T14:20:30Z',
  },
  // ds-003: 产品库存.sqlite — 2 tables
  {
    id: 'tbl-005',
    dataSourceId: 'ds-003',
    userId: 'user-001',
    pgSchema: 'ds_003',
    pgTableName: 'products',
    displayName: '产品目录',
    description: '产品基本信息及价格',
    columnSchema: [
      { name: 'product_id', type: 'varchar', nullable: false, comment: '产品编号' },
      { name: 'name', type: 'varchar', nullable: false, comment: '产品名称' },
      { name: 'category', type: 'varchar', nullable: false, comment: '分类' },
      { name: 'price', type: 'float8', nullable: false, comment: '零售价' },
      { name: 'cost', type: 'float8', nullable: false, comment: '成本价' },
      { name: 'is_active', type: 'bool', nullable: false, comment: '是否在售' },
    ],
    rowCount: 320,
    isWritable: false,
    createdAt: '2026-02-18T09:00:10Z',
    updatedAt: '2026-02-18T09:00:10Z',
  },
  {
    id: 'tbl-006',
    dataSourceId: 'ds-003',
    userId: 'user-001',
    pgSchema: 'ds_003',
    pgTableName: 'inventory',
    displayName: '库存记录',
    columnSchema: [
      { name: 'id', type: 'int4', nullable: false, comment: '主键' },
      { name: 'product_id', type: 'varchar', nullable: false, comment: '产品编号' },
      { name: 'warehouse', type: 'varchar', nullable: false, comment: '仓库' },
      { name: 'quantity', type: 'int4', nullable: false, comment: '库存数量' },
      { name: 'min_stock', type: 'int4', nullable: false, comment: '最低库存' },
      { name: 'last_restock', type: 'date', nullable: true, comment: '上次补货日期' },
      { name: 'updated_at', type: 'timestamp', nullable: false, comment: '更新时间' },
    ],
    rowCount: 890,
    isWritable: false,
    createdAt: '2026-02-18T09:00:20Z',
    updatedAt: '2026-02-18T09:00:20Z',
  },
]

const REGIONS = ['华东', '华南', '华北', '西南', '西北', '华中', '东北']
const PRODUCTS = ['智能手表Pro', '无线耳机Max', '蓝牙音箱S1', '充电宝20000mAh', '数据线套装', 'USB-C转接头', '手机壳精选', '屏幕保护膜']
const SALESPERSONS = ['张伟', '李娜', '王芳', '刘强', '陈敏', '杨洋', '赵磊', '黄丽']
const COMPANIES = ['星辰科技有限公司', '蓝海贸易集团', '金鼎建材公司', '天润食品有限公司', '华创软件科技', '盛世电子商务', '鑫达物流有限公司', '中科信息技术']
const CONTACTS = ['张经理', '李总', '王主任', '刘工', '陈总监', '杨助理', '赵部长', '黄总']
const CITIES = ['上海', '北京', '深圳', '广州', '杭州', '成都', '南京', '武汉']
const CATEGORIES = ['智能穿戴', '音频设备', '充电配件', '手机配件', '电脑周边', '办公设备']
const WAREHOUSES = ['上海仓', '北京仓', '广州仓', '成都仓']

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

function generateTableRows(tableId: string, page: number): Record<string, any>[] {
  const rand = seededRandom(tableId.charCodeAt(4) * 1000 + page * 100)
  const rows: Record<string, any>[] = []

  for (let i = 0; i < 50; i++) {
    const idx = page * 50 + i
    switch (tableId) {
      case 'tbl-001':
        rows.push({
          id: idx + 1,
          month: `2024-${String((idx % 12) + 1).padStart(2, '0')}-01`,
          region: REGIONS[Math.floor(rand() * REGIONS.length)],
          total_amount: Math.round(rand() * 500000 + 100000),
          order_count: Math.floor(rand() * 200 + 50),
          avg_price: Math.round(rand() * 300 + 50),
          is_target_met: rand() > 0.3,
          updated_at: '2026-01-15T08:31:00Z',
        })
        break
      case 'tbl-002':
        rows.push({
          order_id: `ORD-2024${String(idx + 1).padStart(6, '0')}`,
          product_name: PRODUCTS[Math.floor(rand() * PRODUCTS.length)],
          quantity: Math.floor(rand() * 20) + 1,
          unit_price: Math.round(rand() * 500 + 29),
          total_price: Math.round(rand() * 5000 + 100),
          sale_date: `2024-${String(Math.floor(rand() * 12) + 1).padStart(2, '0')}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}`,
          salesperson: SALESPERSONS[Math.floor(rand() * SALESPERSONS.length)],
        })
        break
      case 'tbl-003':
        rows.push({
          id: idx + 1,
          region: REGIONS[Math.floor(rand() * REGIONS.length)],
          year: 2024,
          quarter: (idx % 4) + 1,
          target_amount: Math.round(rand() * 1000000 + 500000),
          actual_amount: rand() > 0.2 ? Math.round(rand() * 1000000 + 400000) : null,
        })
        break
      case 'tbl-004':
        rows.push({
          customer_id: `C${String(idx + 1).padStart(5, '0')}`,
          company_name: COMPANIES[Math.floor(rand() * COMPANIES.length)],
          contact_name: CONTACTS[Math.floor(rand() * CONTACTS.length)],
          phone: `1${Math.floor(rand() * 9) + 3}${String(Math.floor(rand() * 100000000)).padStart(8, '0')}`,
          email: rand() > 0.2 ? `contact${idx}@example.com` : null,
          city: CITIES[Math.floor(rand() * CITIES.length)],
          is_vip: rand() > 0.7,
          created_at: `2025-${String(Math.floor(rand() * 12) + 1).padStart(2, '0')}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}T10:00:00Z`,
        })
        break
      case 'tbl-005':
        rows.push({
          product_id: `P${String(idx + 1).padStart(4, '0')}`,
          name: PRODUCTS[Math.floor(rand() * PRODUCTS.length)] + (idx > 7 ? ` V${Math.floor(rand() * 3) + 1}` : ''),
          category: CATEGORIES[Math.floor(rand() * CATEGORIES.length)],
          price: Math.round(rand() * 800 + 19.9),
          cost: Math.round(rand() * 400 + 10),
          is_active: rand() > 0.15,
        })
        break
      case 'tbl-006':
        rows.push({
          id: idx + 1,
          product_id: `P${String(Math.floor(rand() * 320) + 1).padStart(4, '0')}`,
          warehouse: WAREHOUSES[Math.floor(rand() * WAREHOUSES.length)],
          quantity: Math.floor(rand() * 500),
          min_stock: Math.floor(rand() * 50) + 10,
          last_restock: rand() > 0.3 ? `2026-0${Math.floor(rand() * 2) + 1}-${String(Math.floor(rand() * 28) + 1).padStart(2, '0')}` : null,
          updated_at: '2026-02-18T09:00:20Z',
        })
        break
    }
  }
  return rows
}

const TABLE_ROW_COUNTS: Record<string, number> = {
  'tbl-001': 156,
  'tbl-002': 2340,
  'tbl-003': 48,
  'tbl-004': 580,
  'tbl-005': 320,
  'tbl-006': 890,
}

export function getMockTableData(tableId: string, page: number): TableDataPage {
  const totalCount = TABLE_ROW_COUNTS[tableId] ?? 100
  const data = generateTableRows(tableId, page)
  const start = page * 50
  const remaining = totalCount - start
  const trimmed = data.slice(0, Math.min(50, Math.max(0, remaining)))

  return {
    data: trimmed,
    totalCount,
    nextCursor: start + 50 < totalCount ? String(page + 1) : null,
    hasMore: start + 50 < totalCount,
  }
}
