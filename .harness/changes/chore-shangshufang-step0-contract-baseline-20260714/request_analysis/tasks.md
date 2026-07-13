# 任务：chore-shangshufang-step0-contract-baseline-20260714

## 任务 1

- 目标：冻结上书房正式 API 请求、来源词汇和黄金行为现状。
- 前置条件：用户已批准 S1；不改变运行逻辑。
- 输入：FastAPI OpenAPI、前端 adapters、既有 API tests。
- 输出：backend JSON baseline/Python test、frontend Node test。
- 涉及文件：`backend/tests/fixtures/`、`backend/tests/test_shangshufang_contract_baseline.py`、frontend contract baseline test。
- 状态 / 数据变化：测试使用隔离内存 DB；无运行数据变化。
- 验证命令与证据：专项 pytest、tsx node test。
- 回滚边界：删除新增测试/fixture。
- 完成定义：8 个新测试通过且 known gaps 未被掩盖。

## 任务 2

- 目标：建立 S1 进程、STOP、数据库、旧路径、待审队列与架构基线。
- 前置条件：只读取证。
- 输入：git/worktree、ss/proc、prod:doctor、rg、SQLite 只读计数。
- 输出：`baseline.md`、`adr.md`、`threat-model.md`、`s1-inventory.md`。
- 涉及文件：仅本 change。
- 状态 / 数据变化：无。
- 验证命令与证据：静态字段检查、对抗复审。
- 回滚边界：删除文档不影响运行时。
- 完成定义：每个未知项有 blocks_steps，ADR 无悬空冲突。

## 任务 3

- 目标：完善十阶段 launch blueprint 并准确记录 S1 当前进度。
- 前置条件：基线证据已产生。
- 输入：用户批准路线、本 change 证据、控制面细化蓝图。
- 输出：更新 `plans/chaotang-os-launch-blueprint-2026-07-14.md`。
- 涉及文件：指定 plan。
- 状态 / 数据变化：无。
- 验证命令与证据：Markdown/diff check、对抗复审。
- 回滚边界：回滚本轮段落。
- 完成定义：十阶段、指标、TDD/verification、S1进度和 S10 外部信任锚一致。
