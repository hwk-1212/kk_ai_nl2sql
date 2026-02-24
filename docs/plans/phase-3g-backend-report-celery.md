# Phase 3-G: 后端 — AI 报告 + 定时任务

> **状态**: ✅ 已完成

## 目标

实现 AI 驱动的报告生成引擎：手动生成和定时自动生成报告，使用 LLM 根据数据查询结果生成 Markdown 格式的分析报告，通过 Celery Beat 调度定时任务。

---

## 前置条件

- Phase 3-D 语义层已完成 (指标可查询)
- Phase 3-B NL2SQL 工具集已完成 (数据可查询)
- Phase 0 Celery Worker/Beat 已部署

---

## 3G.1 Report ORM 模型完善

**文件**: `backend/app/models/report.py`

```python
class Report(Base):
    __tablename__ = "reports"
    id: UUID
    user_id: UUID                   # FK users.id
    tenant_id: UUID?                # FK tenants.id
    title: str
    content: TEXT                    # Markdown 格式报告内容
    report_type: str                # "manual" | "scheduled"
    template_id: UUID?              # FK report_templates.id
    data_config: JSON               # 关联的表/指标/查询配置
    charts: JSON                    # 报告内嵌图表配置 [{chartType, data, ...}]
    minio_path: str?                # 导出的 PDF/HTML 路径
    status: str                     # "draft" | "generating" | "ready" | "failed"
    error_message: str?
    schedule_id: UUID?              # FK report_schedules.id
    created_at / updated_at
```

**文件**: `backend/app/models/report_template.py`

```python
class ReportTemplate(Base):
    __tablename__ = "report_templates"
    id: UUID
    user_id: UUID?                  # null = 系统模板
    tenant_id: UUID?
    name: str
    description: str
    template_content: TEXT          # Markdown 模板 (含 {{placeholder}})
    data_config: JSON               # 需要的数据查询配置
    category: str
    is_system: bool = False
    created_at / updated_at
```

**文件**: `backend/app/models/report_schedule.py`

```python
class ReportSchedule(Base):
    __tablename__ = "report_schedules"
    id: UUID
    user_id: UUID
    tenant_id: UUID?
    report_template_id: UUID?       # FK report_templates.id
    name: str
    cron_expression: str            # "0 9 * * *"
    data_config: JSON               # 数据查询配置
    is_active: bool = True
    last_run_at: datetime?
    next_run_at: datetime?
    created_at / updated_at
```

---

## 3G.2 报告生成引擎

**文件**: `backend/app/core/report/generator.py`

```python
class ReportGenerator:
    """AI 报告生成引擎"""

    REPORT_PROMPT = """你是专业的数据分析报告撰写者。
根据以下数据查询结果，生成一份结构化的分析报告。

报告要求:
1. 包含概述、关键发现、详细分析、趋势洞察、建议
2. 使用 Markdown 格式
3. 数据引用必须精确
4. 给出可操作的业务建议
5. 语言简洁专业

{template_instructions}

数据查询结果:
{query_results}

请生成报告:"""

    async def generate(
        self, report: Report, template: ReportTemplate | None,
        db: AsyncSession, llm_router
    ) -> str:
        """
        生成报告:
        1. 根据 data_config 执行所有数据查询
        2. 收集查询结果
        3. 如有模板，组装模板指令
        4. 调用 LLM 生成报告内容 (Markdown)
        5. 调用 recommend_chart 为关键数据推荐图表
        6. 更新 Report.content + Report.charts
        7. 更新状态为 ready
        """

    async def _execute_data_queries(
        self, data_config: dict, user: User, db: AsyncSession
    ) -> list[QueryResult]:
        """执行报告所需的数据查询"""

    async def _recommend_charts(
        self, query_results: list[QueryResult]
    ) -> list[ChartConfig]:
        """为查询结果推荐图表"""

    async def export_pdf(self, report: Report) -> str:
        """导出为 PDF 存储到 MinIO, 返回路径"""

    async def export_html(self, report: Report) -> str:
        """导出为 HTML 存储到 MinIO, 返回路径"""
```

---

## 3G.3 定时调度器

**文件**: `backend/app/core/report/scheduler.py`

```python
class ReportScheduler:
    """报告定时调度管理"""

    async def register_schedule(self, schedule: ReportSchedule):
        """注册定时任务到 Celery Beat"""

    async def unregister_schedule(self, schedule_id: str):
        """取消定时任务"""

    async def update_schedule(self, schedule: ReportSchedule):
        """更新定时任务配置"""

    def calculate_next_run(self, cron_expression: str) -> datetime:
        """计算下次运行时间"""
```

---

## 3G.4 Celery 异步任务

**文件**: `backend/app/tasks/report_tasks.py`

```python
@celery_app.task(bind=True, max_retries=3)
def generate_report_task(self, report_id: str):
    """
    异步生成报告:
    1. 从 DB 加载 Report
    2. 更新状态为 generating
    3. 调用 ReportGenerator.generate()
    4. 更新状态为 ready / failed
    5. 失败时自动重试 (3 次)
    """

@celery_app.task
def scheduled_report_task(schedule_id: str):
    """
    定时报告生成:
    1. 从 DB 加载 ReportSchedule
    2. 创建新 Report 记录
    3. 调用 generate_report_task
    4. 更新 schedule.last_run_at / next_run_at
    """

@celery_app.task
def cleanup_old_reports():
    """
    清理过期报告 (可选):
    - 保留 90 天内的报告
    - 过期报告 MinIO 文件清理
    """
```

### Celery Beat 调度配置

```python
celery_app.conf.beat_schedule.update({
    "check-scheduled-reports": {
        "task": "app.tasks.report_tasks.check_and_run_schedules",
        "schedule": crontab(minute="*/5"),  # 每 5 分钟检查
    },
})
```

> 注: 每 5 分钟检查一次 `report_schedules` 表中 `next_run_at <= now()` 且 `is_active=True` 的任务。

---

## 3G.5 报告管理 API

**文件**: `backend/app/api/v1/reports.py`

### Report CRUD

| 端点 | 方法 | 功能 |
|------|------|------|
| `/reports` | GET | 列出报告 (分页, 状态筛选) |
| `/reports` | POST | 创建报告 (手动) |
| `/reports/{id}` | GET | 报告详情 (含内容) |
| `/reports/{id}` | PUT | 更新报告 |
| `/reports/{id}` | DELETE | 删除报告 |
| `/reports/{id}/generate` | POST | 触发 AI 生成 (异步) |
| `/reports/{id}/export` | GET | 导出 PDF/HTML |

### Template CRUD

| 端点 | 方法 | 功能 |
|------|------|------|
| `/reports/templates` | GET | 列出模板 (系统+用户) |
| `/reports/templates` | POST | 创建模板 |
| `/reports/templates/{id}` | PUT | 更新模板 |
| `/reports/templates/{id}` | DELETE | 删除模板 |

### Schedule CRUD

| 端点 | 方法 | 功能 |
|------|------|------|
| `/reports/schedules` | GET | 列出定时任务 |
| `/reports/schedules` | POST | 创建定时任务 |
| `/reports/schedules/{id}` | PUT | 更新任务 |
| `/reports/schedules/{id}` | DELETE | 删除任务 |
| `/reports/schedules/{id}/toggle` | PATCH | 启用/停用 |
| `/reports/schedules/{id}/run` | POST | 手动触发运行 |

---

## 3G.6 系统预置模板

系统启动时预置基础报告模板:

| 模板名称 | 描述 |
|----------|------|
| 日报模板 | 按天统计关键指标，趋势对比 |
| 周报模板 | 按周汇总，环比分析 |
| 月报模板 | 月度总结 + 环比同比 |
| 自定义查询报告 | 自由配置查询和图表 |

---

## 3G.7 Pydantic Schemas

**文件**: `backend/app/schemas/report.py`

- `ReportCreate`, `ReportUpdate`, `ReportResponse`
- `ReportTemplateCreate`, `ReportTemplateResponse`
- `ReportScheduleCreate`, `ReportScheduleUpdate`, `ReportScheduleResponse`
- `GenerateReportRequest`

---

## 任务清单

- [x] 完善 Report / ReportTemplate / ReportSchedule ORM 模型
- [x] 实现 ReportGenerator (LLM 驱动生成 + 图表推荐)
- [x] 实现 ReportScheduler (Celery Beat 调度)
- [x] 实现 Celery 异步任务 (生成 + 定时 + 清理)
- [x] 实现报告管理 API (Report/Template/Schedule CRUD)
- [x] 系统预置模板初始化
- [x] 报告导出 (PDF/HTML → MinIO)
- [x] Pydantic schemas
- [x] 验证通过

---

## 验证标准

- [x] 创建报告 → 触发生成 → 状态 generating → ready
- [x] 生成的报告内容为结构化 Markdown (含标题/概述/分析/建议)
- [x] 报告包含推荐图表配置
- [x] 模板 CRUD 正常
- [x] 定时任务创建 → 到点自动生成报告
- [x] 手动触发定时任务正常
- [x] 启用/停用 Toggle 生效
- [x] 报告导出 PDF 到 MinIO
- [x] Celery Worker 日志显示任务执行
- [x] 失败任务自动重试 (最多 3 次)

---

## 新增/修改文件列表

### 新增/完善

| 文件 | 说明 |
|------|------|
| `app/models/report.py` | 完善 Report ORM |
| `app/models/report_template.py` | 完善 ReportTemplate ORM |
| `app/models/report_schedule.py` | 完善 ReportSchedule ORM |
| `app/core/report/generator.py` | 完整实现报告生成引擎 |
| `app/core/report/scheduler.py` | 完整实现定时调度器 |
| `app/tasks/report_tasks.py` | 完整实现 Celery 任务 |
| `app/schemas/report.py` | 完善 Pydantic schemas |
| `app/api/v1/reports.py` | 完整实现报告管理 API |

### 修改

| 文件 | 变更 |
|------|------|
| `app/main.py` | 初始化 ReportGenerator + 预置模板 + 注册路由 |
| `app/tasks/__init__.py` | 注册报告相关 beat_schedule |

---

## 实现说明

### 已完成功能

1. **Report ORM** (`backend/app/models/report.py`)
   - 新增字段: data_config (JSONB), charts (JSONB), minio_path, error_message, schedule_id (FK)

2. **ReportTemplate ORM** (`backend/app/models/report_template.py`)
   - 新增字段: user_id (FK), tenant_id (FK), template_content (Text), data_config (JSONB), updated_at
   - template_content 从 JSONB 改为 Text

3. **ReportSchedule ORM** (`backend/app/models/report_schedule.py`)
   - 新增字段: name, tenant_id (FK), data_config (JSONB)
   - template_id 改为可空

4. **ReportGenerator** (`backend/app/core/report/generator.py`)
   - generate(): data_config → 执行 SQL → 收集结果 → LLM 生成 Markdown → 图表推荐
   - generate_from_query(): 单条 SQL → 简报
   - 内置 SQL 安全检查 (SQLSecurityChecker)
   - 自动图表推荐 (line/bar/scatter/table)

5. **ReportScheduler** (`backend/app/core/report/scheduler.py`)
   - create_schedule / update_schedule / toggle / mark_run
   - get_due_schedules: 查询 next_run_at <= now() 且 is_active=True
   - 使用 croniter 计算下次运行时间

6. **Celery 任务** (`backend/app/tasks/report_tasks.py`)
   - generate_report: 异步报告生成 (max_retries=3, countdown=30s)
   - scheduled_report: 定时报告 (创建 Report → 触发 generate_report)
   - check_scheduled_reports: 每 5 分钟检查到期任务 (Celery Beat)

7. **报告管理 API** (`backend/app/api/v1/reports.py`)
   - Report: GET /, POST /, GET /{id}, PUT /{id}, DELETE /{id}, POST /{id}/generate, GET /{id}/export
   - Template: GET /templates/list, POST /templates, PUT /templates/{id}, DELETE /templates/{id}
   - Schedule: GET /schedules/list, POST /schedules, PUT /schedules/{id}, DELETE /schedules/{id}, PATCH /schedules/{id}/toggle, POST /schedules/{id}/run

8. **Pydantic Schemas** (`backend/app/schemas/report.py`)
   - ReportCreate/Update/Response, GenerateReportRequest
   - ReportTemplateCreate/Update/Response
   - ReportScheduleCreate/Update/Response

9. **系统预置模板**
   - 日报 / 周报 / 月报 / 自定义查询报告 (4 个)
   - 启动时自动创建 (如不存在)

10. **Celery Beat 配置**
    - check-scheduled-reports: 每 5 分钟 (crontab minute=*/5)

---

## 代码审查修复 (2026-02-24)

| # | 严重度 | 文件 | 问题 | 修复 |
|---|--------|------|------|------|
| 1 | 🔴严重 | `generator.py` | `_call_llm` 使用 `model=` 参数但 llm_router.stream 接受 `model_id=`；chunk 用 `.get("content")` 但流返回对象属性 `chunk.type` / `chunk.data` | 改为 `model_id=GENERATE_MODEL`，chunk 取值改为 `chunk.type == "content" and chunk.data` |
