# Task 9 浏览器验收假绿

## Summary

Task 9 的固定命令矩阵连续 10 轮通过后，真实浏览器验收仍发现锦衣卫调查列表可读取、但任一已解决案卷详情稳定显示“读取中断”。同源详情 BFF 对现有案卷返回 HTTP 503，说明代码级验收不能单独代表用户可见闭环通过。

## Root Cause

Task 9 的最终验收矩阵覆盖后端测试、静态检查和 harness，但没有启动现有前后端服务并通过浏览器读取真实运行库中的调查详情。测试夹具与契约测试验证了隔离场景，却没有覆盖“现有运行数据 + 当前迁移状态 + BFF 详情读取”的组合，因此 10 轮结果对该用户路径没有检测能力。

## Prevention

凡是后端运行时 Skill、调查审计或史馆契约发生变化，最终验收应增加只读本地浏览器冒烟：加载锦衣卫列表、切换至少一个非空状态筛选，并打开一条现有案卷详情。冒烟不得触发调查、模型调用、外网或生产写入；运行库不可安全使用时，应准备经过同一迁移链构建的临时代表性数据库。

## Detection

自动检查应启动 FastAPI 与 Next.js，在无外网模式请求 `GET /api/jinyiwei/investigations?status=RESOLVED&limit=20&offset=0`，从成功列表取得真实 ID，再要求 `GET /api/jinyiwei/investigations/{id}` 返回 200 且通过完整详情契约。浏览器层还应确认筛选后的案卷详情不出现“读取中断”。在该自动化落地前，这一步必须作为人工最终验收项，且不能由单元测试或 10 轮固定矩阵替代。

## Evidence

- 2026-08-03 Task 9 验收账本：`.superpowers/sdd/independent-runtime-skills-task-9-acceptance.log`，结果 `PASS 10/10`。
- 浏览器路径：`/jinyiwei` 加载 73 卷；“已解决”筛选加载 8 卷；点击首卷后详情显示“读取中断”。
- 同源只读 API：列表返回 200；`GET /api/jinyiwei/investigations/b3d14305-7c0b-4c0d-9290-983abc479eeb` 返回 503，响应原因为 `storage`。
- 相关边界：`docs/decisions/0028-decree-evidence-flow-governance-baseline.md` 与 `frontend/AGENTS.md` 的锦衣卫只读调查台约束。
