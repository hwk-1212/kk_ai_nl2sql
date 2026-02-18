import type { Report, ReportTemplate, ReportSchedule, DataRole } from '@/types'

export const MOCK_REPORTS: Report[] = [
  {
    id: 'rpt-1',
    userId: 'u1',
    title: '月度销售报告 - 2026年1月',
    reportType: 'scheduled',
    status: 'ready',
    sections: [
      {
        id: 's1',
        title: '概述',
        content: '本报告基于 2026 年 1 月全渠道销售数据自动生成，涵盖销售总额、订单量、客单价、毛利率等核心指标，并对区域分布、渠道构成、商品排行进行深度分析。\n\n**报告周期**: 2026-01-01 ~ 2026-01-31\n**数据来源**: 销售数据2024.xlsx, 客户信息.csv',
        children: [],
      },
      {
        id: 's2',
        title: '关键指标',
        content: '',
        children: [
          {
            id: 's2-1',
            title: '销售总额',
            content: '本月销售总额 **¥2,450,000**，环比增长 **12.3%**，同比增长 **8.7%**。\n\n| 维度 | 金额 | 环比 |\n|---|---|---|\n| 线上渠道 | ¥1,568,000 | +15.2% |\n| 线下门店 | ¥882,000 | +7.1% |\n\n> 线上渠道增速显著高于线下，主要受益于年终促销活动拉动。',
            children: [],
          },
          {
            id: 's2-2',
            title: '订单量与客单价',
            content: '- **总订单量**: 3,200 单 (环比 +9.6%)\n- **客单价**: ¥765.6 (环比 -2.1%)\n- **客单价下降原因**: 促销期间低价商品销量增长较快\n\n日均订单量约 **103 单**，峰值出现在 1 月 15 日（年货节），达 **210 单/天**。',
            children: [],
          },
          {
            id: 's2-3',
            title: '毛利率分析',
            content: '综合毛利率 **32.5%**，较上月下降 1.2 个百分点。\n\n- 电子产品毛利率: 28.3% (下降 2.1pp)\n- 服装毛利率: 45.6% (持平)\n- 食品毛利率: 22.1% (上升 0.8pp)\n\n电子产品毛利下降主要系年终清仓折扣力度加大所致。',
            children: [],
          },
        ],
      },
      {
        id: 's3',
        title: '区域分析',
        content: '各区域销售表现如下：\n\n| 区域 | 销售额 | 占比 | 环比 |\n|---|---|---|---|\n| 华东 | ¥1,029,000 | 42.0% | +14.5% |\n| 华南 | ¥514,500 | 21.0% | +8.2% |\n| 华北 | ¥392,000 | 16.0% | +11.3% |\n| 西南 | ¥269,500 | 11.0% | +15.8% |\n| 其他 | ¥245,000 | 10.0% | +6.4% |\n\n**亮点**: 西南地区增速最快 (+15.8%)，成都和重庆市场贡献突出。\n\n**关注**: 华南地区增速相对放缓，建议加强营销投入。',
        children: [],
      },
      {
        id: 's4',
        title: '商品排行 Top 10',
        content: '| 排名 | 商品 | 销量 | 销售额 |\n|---|---|---|---|\n| 1 | iPhone 15 Pro | 280 台 | ¥2,380,000 |\n| 2 | 羽绒服（冬季款） | 520 件 | ¥416,000 |\n| 3 | MacBook Air M3 | 95 台 | ¥855,000 |\n| 4 | 坚果礼盒套装 | 1,200 份 | ¥180,000 |\n| 5 | 运动鞋（联名款） | 340 双 | ¥272,000 |\n| 6 | 蓝牙耳机 Pro | 450 副 | ¥315,000 |\n| 7 | 护肤套装 | 380 套 | ¥228,000 |\n| 8 | 智能手表 | 210 块 | ¥189,000 |\n| 9 | 年货大礼包 | 800 份 | ¥160,000 |\n| 10 | 加湿器 | 290 台 | ¥116,000 |',
        children: [],
      },
      {
        id: 's5',
        title: '趋势与建议',
        content: '',
        children: [
          {
            id: 's5-1',
            title: '趋势洞察',
            content: '1. **移动端占比持续提升**，已达 68%，建议优化移动端购物体验\n2. **新客转化率 3.8%**，高于行业平均 2.5%，获客策略有效\n3. **复购率 42%**，环比提升 3 个百分点，用户粘性增强\n4. **直播电商渠道** 贡献 15% 销售额，增速 45%，为新增长引擎',
            children: [],
          },
          {
            id: 's5-2',
            title: '运营建议',
            content: '- **优化华南地区营销策略**：增加区域定向投放预算，联合本地 KOL 推广\n- **提升客单价**：减少深度折扣，推出满减/组合套装等提升 AOV 的策略\n- **加强用户留存运营**：建立会员积分体系，增加复购激励\n- **拓展西南市场**：西南地区增速最快，建议增设成都仓库缩短配送时效\n- **数据驱动选品**：基于销售数据优化 SKU 结构，淘汰低效商品',
            children: [],
          },
        ],
      },
    ],
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-01T09:05:00Z',
  },
  {
    id: 'rpt-2',
    userId: 'u1',
    title: '周报 - 第7周',
    reportType: 'manual',
    status: 'draft',
    sections: [
      { id: 'w1', title: '本周概况', content: '待填写...', children: [] },
      { id: 'w2', title: '关键数据', content: '', children: [
        { id: 'w2-1', title: '销售数据', content: '待填写...', children: [] },
        { id: 'w2-2', title: '运营数据', content: '待填写...', children: [] },
      ]},
      { id: 'w3', title: '问题与风险', content: '待填写...', children: [] },
      { id: 'w4', title: '下周计划', content: '待填写...', children: [] },
    ],
    createdAt: '2026-02-14T08:00:00Z',
    updatedAt: '2026-02-14T08:00:00Z',
  },
  {
    id: 'rpt-3',
    userId: 'u1',
    title: 'Q1 季度分析报告',
    reportType: 'manual',
    status: 'generating',
    sections: [
      { id: 'q1', title: '季度概述', content: '', children: [] },
      { id: 'q2', title: '核心指标达成', content: '', children: [] },
      { id: 'q3', title: '分品类分析', content: '', children: [] },
      { id: 'q4', title: '同比环比对比', content: '', children: [] },
      { id: 'q5', title: '下季度目标', content: '', children: [] },
    ],
    createdAt: '2026-02-18T10:00:00Z',
    updatedAt: '2026-02-18T10:00:00Z',
  },
  {
    id: 'rpt-4',
    userId: 'u1',
    title: '异常数据告警报告',
    reportType: 'scheduled',
    status: 'failed',
    createdAt: '2026-02-17T03:00:00Z',
    updatedAt: '2026-02-17T03:01:00Z',
  },
]

export const MOCK_TEMPLATES: ReportTemplate[] = [
  {
    id: 'tpl-1',
    name: '月度报告模板',
    description: '包含销售概览、关键指标趋势、Top 商品排行、区域分析等章节',
    category: '销售',
    outline: [
      { id: 'o1', title: '概述', content: '', children: [] },
      { id: 'o2', title: '关键指标', content: '', children: [
        { id: 'o2-1', title: '销售总额', content: '', children: [] },
        { id: 'o2-2', title: '订单量与客单价', content: '', children: [] },
        { id: 'o2-3', title: '毛利率分析', content: '', children: [] },
      ]},
      { id: 'o3', title: '区域分析', content: '', children: [] },
      { id: 'o4', title: '商品排行 Top 10', content: '', children: [] },
      { id: 'o5', title: '趋势与建议', content: '', children: [
        { id: 'o5-1', title: '趋势洞察', content: '', children: [] },
        { id: 'o5-2', title: '运营建议', content: '', children: [] },
      ]},
    ],
    isSystem: true,
    createdAt: '2025-11-01T08:00:00Z',
  },
  {
    id: 'tpl-2',
    name: '周报模板',
    description: '适用于周度数据汇总，包含本周对比、环比分析',
    category: '通用',
    outline: [
      { id: 'wo1', title: '本周概况', content: '', children: [] },
      { id: 'wo2', title: '关键数据', content: '', children: [
        { id: 'wo2-1', title: '销售数据', content: '', children: [] },
        { id: 'wo2-2', title: '运营数据', content: '', children: [] },
      ]},
      { id: 'wo3', title: '问题与风险', content: '', children: [] },
      { id: 'wo4', title: '下周计划', content: '', children: [] },
    ],
    isSystem: true,
    createdAt: '2025-11-01T08:00:00Z',
  },
  {
    id: 'tpl-3',
    name: '自定义模板',
    description: '用户自定义报告结构，灵活配置章节和指标',
    category: '自定义',
    isSystem: false,
    createdAt: '2026-01-20T10:00:00Z',
  },
]

export const MOCK_SCHEDULES: ReportSchedule[] = [
  {
    id: 'sch-1',
    userId: 'u1',
    templateId: 'tpl-1',
    templateName: '月度报告模板',
    cronExpression: '0 9 * * *',
    cronDescription: '每天 9:00',
    isActive: true,
    lastRunAt: '2026-02-18T09:00:00Z',
    nextRunAt: '2026-02-19T09:00:00Z',
    createdAt: '2026-01-01T08:00:00Z',
  },
  {
    id: 'sch-2',
    userId: 'u1',
    templateId: 'tpl-2',
    templateName: '周报模板',
    cronExpression: '0 9 * * 1',
    cronDescription: '每周一 9:00',
    isActive: false,
    lastRunAt: '2026-02-10T09:00:00Z',
    nextRunAt: '2026-02-24T09:00:00Z',
    createdAt: '2026-01-15T08:00:00Z',
  },
]

export const MOCK_DATA_ROLES: DataRole[] = [
  {
    id: 'role-1',
    name: '销售分析师',
    description: '可访问销售、订单相关数据表，不可修改数据',
    userCount: 3,
    createdAt: '2025-12-01T08:00:00Z',
  },
  {
    id: 'role-2',
    name: '财务只读',
    description: '仅可读取财务汇总表，敏感字段脱敏',
    userCount: 2,
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'role-3',
    name: '数据管理员',
    description: '全部数据表读写权限',
    userCount: 1,
    createdAt: '2025-11-15T08:00:00Z',
  },
]

/**
 * Mock AI 生成：基于 sections 骨架逐章节填充内容
 */
export const MOCK_AI_SECTIONS_CONTENT: Record<string, string> = {
  '概述': '本报告基于最近 30 天的业务数据自动生成，涵盖销售、运营、用户等核心维度的指标分析。\n\n**报告周期**: 最近 30 天\n**生成时间**: ' + new Date().toLocaleDateString('zh-CN'),
  '销售总额': '本期销售总额 **¥3,120,000**，环比增长 **15.2%**。\n\n| 渠道 | 金额 | 占比 | 环比 |\n|---|---|---|---|\n| 线上 | ¥2,028,000 | 65% | +18.3% |\n| 线下 | ¥1,092,000 | 35% | +9.8% |',
  '订单量与客单价': '- **总订单量**: 4,100 单 (环比 +11.2%)\n- **客单价**: ¥761 (环比 -1.8%)\n- **日均订单**: 137 单',
  '毛利率分析': '综合毛利率 **33.1%**，同比上升 0.6 个百分点。高毛利品类（服装、美妆）占比提升是主要驱动因素。',
  '区域分析': '| 区域 | 销售额 | 占比 |\n|---|---|---|\n| 华东 | ¥1,310,400 | 42% |\n| 华南 | ¥655,200 | 21% |\n| 华北 | ¥499,200 | 16% |\n| 西南 | ¥343,200 | 11% |\n| 其他 | ¥312,000 | 10% |',
  '商品排行 Top 10': '| 排名 | 商品 | 销量 | 销售额 |\n|---|---|---|---|\n| 1 | 旗舰手机 | 350 | ¥2,800,000 |\n| 2 | 冬季外套 | 680 | ¥544,000 |\n| 3 | 笔记本电脑 | 120 | ¥1,080,000 |',
  '趋势洞察': '1. 移动端占比持续提升至 **70%**\n2. 新客转化率稳定在 **3.5%** 以上\n3. 直播电商贡献 **18%** 销售额',
  '运营建议': '- 加大华南地区营销投入\n- 优化促销策略提升客单价\n- 建立会员积分体系增强复购',
  '本周概况': '本周（第 N 周）销售运营总体表现平稳，核心指标达成率符合预期。',
  '销售数据': '- 周销售额：¥620,000\n- 周订单量：810 单\n- 周环比：+3.2%',
  '运营数据': '- DAU：12,500\n- 页面 PV：89,000\n- 平均停留时间：4.2 分钟',
  '问题与风险': '- 物流配送时效部分区域有延迟\n- 退货率略有上升，需关注品质',
  '下周计划': '- 启动春季新品上线\n- 优化搜索推荐算法\n- 完成年度复盘报告',
}
