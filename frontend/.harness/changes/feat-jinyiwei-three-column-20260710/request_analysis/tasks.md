# 任务拆解

## 任务 1：对齐后端事实源

- 目标：以前端可验证方式表达“检索→核验→裁决→归档”。
- 输入：`backend/web/routers/jinyiwei.py`、`jinyiwei_agent.py`、`jinyiwei_vet.py`。
- 输出：前端 brief 类型和真实 POST 调用。
- 验收：后端相关测试通过，前端不声称未实现能力。
- 依赖：`/api/intel/brief`。

## 任务 2：重构三栏

- 目标：左右栏承载数据与功能，中栏承载情报主视图。
- 输入：现有 JinyiweiPage、signal hook 与地图/产业组件。
- 输出：真实采证左栏、产业/地图中栏、核验结果右栏。
- 验收：浏览器 DOM 与截图确认三栏完整显示。

