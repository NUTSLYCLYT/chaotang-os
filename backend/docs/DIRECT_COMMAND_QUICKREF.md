# 密旨直通车 - 快速参考

## 一、启动命令

```bash
# 开发模式
python -m uvicorn web.main:app --host 127.0.0.1 --port 8081 --reload

# 生产模式
python -m uvicorn web.main:app --host 0.0.0.0 --port 8081 --workers 4
```

## 二、API端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/direct/execute` | POST | 执行命令 |
| `/api/direct/explain` | GET | 路由解释 |
| `/api/direct/stats` | GET | 统计信息 |
| `/api/direct/profiles` | GET | Swarm画像 |
| `/api/direct/feedback` | POST | 提交反馈 |
| `/api/direct/health` | GET | 健康检查 |
| `/api/direct/metrics` | GET | Prometheus指标 |
| `/api/direct/limits/status` | GET | 限流状态 |

## 三、路由模式

| 模式 | 触发条件 | 示例 |
|------|---------|------|
| direct | 简单问答 | "你好"、"什么是OPC？" |
| swarm | 领域关键词 | "分析客户线索" → haolong |
| court | 战略关键词 | "制定策略" → court |

## 四、Swarm领域

| ID | 名称 | 关键词 |
|----|------|--------|
| haolong | 好龙获客 | 获客、线索、意向、跟进 |
| opc | OPC市场 | 商机、市场、行业、动态 |
| product | 产品研发 | 竞品、产品、功能、对比 |
| quotation | 报价 | 报价、价格、成本、利润 |
| sourcing | 采购 | 供应、物料、供应商 |
| finance | 财务 | 财务、资金、发票、回款 |
| legal | 法律 | 合同、合规、条款、风险 |

## 五、限流配置

| 模式 | 限制 | 说明 |
|------|------|------|
| direct | 60次/分钟 | LLM调用 |
| swarm | 10次/分钟 | Swarm执行 |
| court | 5次/5分钟 | 复杂任务 |

## 六、监控指标

```bash
# 查看所有指标
curl http://localhost:8081/api/direct/metrics

# 查看统计
curl http://localhost:8081/api/direct/stats

# 查看告警
curl http://localhost:8081/api/direct/stats | jq .data.alerts
```

## 七、测试命令

```bash
# 运行测试套件
python test_suite.py

# 路由测试
python -c "from src.direct_router import router; print(router.route('分析客户线索'))"

# 监控测试
python -c "from src.direct_monitor import metrics_collector; print(metrics_collector.get_stats())"

# 限流测试
python -c "from src.direct_rate_limit import rate_limiter; print(rate_limiter.get_status())"
```

## 八、故障排查

| 问题 | 解决方法 |
|------|---------|
| 502 Bad Gateway | 检查服务是否启动 |
| 429 Too Many Requests | 等待限流恢复 |
| 500 Internal Error | 查看日志 |
| 路由错误 | 检查关键词配置 |

## 九、关键文件

- `src/direct_router.py` - 路由核心
- `src/direct_cache.py` - 缓存
- `src/direct_feedback.py` - 反馈学习
- `src/direct_monitor.py` - 监控
- `src/direct_rate_limit.py` - 限流
- `src/direct_health.py` - 健康检查
- `web/routers/direct.py` - API