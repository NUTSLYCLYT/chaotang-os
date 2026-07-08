# 东宫系统数据库初始化指南

## 快速开始

### 1. 先决条件
```bash
# 确保已安装依赖
pip install sqlalchemy alembic psycopg2-binary

# 确保PostgreSQL正在运行
# 或使用Docker: docker run -d -e POSTGRES_PASSWORD=password -p 5432:32 postgres:16
```

### 2. 创建数据库
```bash
# 创建chaotang数据库(如不存在)
createdb chaotang

# 或使用psql
psql -U postgres
# CREATE DATABASE chaotang;
```

### 3. 运行迁移
```bash
# 设置数据库连接
export DATABASE_URL="postgresql://postgres:password@localhost:5432/chaotang"

# 进入backend目录
cd ~/chaotang-os/backend

# 运行迁移
alembic upgrade head

# 验证 (应该看到6个新表)
psql chaotang -c "\dt prince_*"
```

## 迁移文件说明

### 迁移文件位置
```
backend/alembic/versions/
├── 0001_create_prince_tables.py  # 创建所有东宫表
└── (后续迁移会在这里)
```

### 6个表的详细说明

#### 1. `prince_policies` (政策约束表)
存储皇帝定义的东宫运营政策

字段:
- `id`: 主键
- `version`: 版本号 (用于追踪历史)
- `policy_json`: 完整的Policy配置 (JSON)
- `notes`: 备注
- `updated_by`: 更新者
- `created_at`, `updated_at`: 时间戳
- `is_active`: 是否生效

示例数据:
```json
{
  "brand": {
    "voice": "professional",
    "forbidden_topics": ["politics", "religion"],
    "tone": "friendly"
  },
  "finance": {
    "daily_cap": 5000,
    "per_transaction_cap": 2000,
    "roi_minimum": 3.0,
    "monthly_burn_rate": 100000
  },
  "risk_matrix": {
    "HIGH": ["新产品", "价格变更>10%"],
    "MEDIUM": ["广告策略调整"],
    "LOW": ["日常优化"]
  }
}
```

#### 2. `prince_decisions` (决策日志表)
记录每个Agent的决策和Policy评估结果

字段:
- `id`: 主键
- `agent_name`: Agent名字 (索引)
- `decision_type`: post/email/ad/etc
- `decision_json`: 完整决策对象
- `policy_check_result`: Policy检查详情
- `verdict`: APPROVE/ESCALATE/BLOCK
- `verdict_reason`: 原因
- `evaluation_time_ms`: 评估耗时

索引:
- `agent_name`: 按Agent查询
- `created_at`: 按时间范围查询

#### 3. `prince_memorials` (奏折表)
存储日报、周报、告警等正式文件

字段:
- `id`: 主键
- `memorial_type`: daily/weekly/alert
- `content`: Markdown格式内容
- `kpi_json`: KPI指标
- `alerts`: 告警列表
- `suggestions`: 建议列表
- `read_by_emperor`: 是否已读
- `emperor_decree`: 皇帝的圣旨
- `decree_at`: 裁决时间
- `created_at`: 生成时间

索引:
- `memorial_type`: 按类型查询
- `read_by_emperor`: 查询未读奏折
- `created_at`: 按日期查询

#### 4. `prince_agent_status` (Agent状态表)
实时跟踪9个Agent的运行状态 (一行一个Agent)

字段:
- `id`: 主键
- `agent_name`: Agent名字 (唯一)
- `status`: idle/running/error/paused
- `last_run`: 最后执行时间
- `last_success`: 最后执行是否成功
- `last_error`: 错误信息
- `metrics_json`: Agent特定的KPI
- `success_rate`: 成功率 (0-1)
- `total_runs`: 总执行次数
- `updated_at`: 最后更新时间

索引:
- `agent_name`: 唯一查询
- `updated_at`: 按更新时间查询

#### 5. `prince_cost_tracking` (成本追踪表)
每个Agent每天的成本和ROI追踪

字段:
- `id`: 主键
- `tracking_date`: YYYY-MM-DD 格式
- `agent_name`: Agent名字
- `cost_usd`: 成本(美元)
- `revenue_usd`: 收入(如果有)
- `roi`: ROI倍数 (revenue/cost)
- `details`: 详细成本分解 (JSON)

索引:
- `tracking_date`: 按日期查询
- `agent_name`: 按Agent查询

示例数据:
```sql
INSERT INTO prince_cost_tracking (tracking_date, agent_name, cost_usd, revenue_usd, roi)
VALUES ('2026-06-02', 'social_media', 100.50, 350.00, 3.48);
```

#### 6. `prince_agent_execution_log` (Agent执行日志表)
每个Agent的每次执行都记录，用于生成奏折

字段:
- `id`: 主键
- `agent_name`: Agent名字
- `task_id`: 任务ID
- `action_type`: post/email/ad/etc
- `outcome_json`: 执行结果 (JSON)
- `metrics_json`: 本次执行的KPI
- `cost_usd`: 成本
- `success`: 是否成功
- `error_message`: 错误信息
- `duration_seconds`: 执行耗时
- `created_at`: 执行时间

索引:
- `agent_name`: 按Agent查询
- `created_at`: 按时间范围查询 (奏折生成时使用)

## 查询示例

### 1. 查看最新的Policy
```sql
SELECT * FROM prince_policies
WHERE is_active = true
ORDER BY updated_at DESC
LIMIT 1;
```

### 2. 统计今天每个Agent的成本
```sql
SELECT agent_name, SUM(cost_usd) as total_cost, COUNT(*) as action_count
FROM prince_agent_execution_log
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY agent_name;
```

### 3. 找出所有被BLOCK的决策
```sql
SELECT * FROM prince_decisions
WHERE verdict = 'BLOCK'
ORDER BY created_at DESC
LIMIT 20;
```

### 4. 查看某个Agent的最近10次执行
```sql
SELECT * FROM prince_agent_execution_log
WHERE agent_name = 'social_media'
ORDER BY created_at DESC
LIMIT 10;
```

### 5. 统计昨日奏折
```sql
SELECT memorial_type, COUNT(*) as count
FROM prince_memorials
WHERE DATE(created_at) = CURRENT_DATE - interval '1 day'
GROUP BY memorial_type;
```

## 迁移操作

### 查看迁移历史
```bash
alembic history
```

### 查看当前迁移版本
```bash
alembic current
```

### 升级到最新
```bash
alembic upgrade head
```

### 回滚一个版本
```bash
alembic downgrade -1
```

### 生成新迁移 (修改了模型后)
```bash
alembic revision --autogenerate -m "describe your changes"
```

## 数据备份和恢复

### 备份(导出)
```bash
pg_dump chaotang > chaotang_backup.sql
```

### 恢复(导入)
```bash
psql chaotang < chaotang_backup.sql
```

### 仅导出prince表
```bash
pg_dump chaotang -t 'prince_*' > prince_tables_backup.sql
```

## 常见问题

### Q: 迁移失败，提示"table already exists"
**A**: 可能表已存在，检查数据库：
```bash
psql chaotang -c "\dt prince_*"
```
如果表存在但想重新迁移，先删除表：
```bash
psql chaotang -c "DROP TABLE IF EXISTS prince_* CASCADE;"
```

### Q: 如何清空所有数据但保留表结构？
**A**: 
```bash
psql chaotang -c "DELETE FROM prince_agent_execution_log; DELETE FROM prince_cost_tracking; ..."
```

### Q: 如何导出奏折为CSV用Excel打开？
**A**:
```bash
psql chaotang -c "COPY (SELECT * FROM prince_memorials WHERE DATE(created_at) = CURRENT_DATE) TO STDOUT CSV HEADER" > memorials.csv
```

## 下一步

迁移完成后，继续：

1. **Phase 1.2**: 实现Policy Engine核心逻辑
2. **Phase 1.3**: 改造BaseAgent，添加Policy检查
3. **Phase 1.4**: 配置Celery任务
4. 最终生成生产级东宫系统

## 参考资源

- [Alembic官方文档](https://alembic.sqlalchemy.org/)
- [PostgreSQL官方文档](https://www.postgresql.org/docs/)
- 东宫架构: `EASTERN_PALACE_HARNESS.md`
