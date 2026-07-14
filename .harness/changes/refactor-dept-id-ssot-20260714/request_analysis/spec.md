# 规格说明：refactor-dept-id-ssot-20260714

## 背景

部门身份曾在前后端多个注册表中重复维护，存在同一部门 ID、路由 ID、四司 ID、
页面 key 和显示名称随实现演进而漂移的风险。P1 将后端规范收敛到部门协议 YAML，
将前端规范收敛到 `dept.ts`，消费者只做派生或显式一致性校验。

原实现提交 `c06d66dffc1c9048040c1ec2506ede68b39ed717` 基于旧战役基线；迁移时重切为
`8a16e8760f34490ba720eb8a662766cc1ddd340d`，父提交固定为
`f9b3e88668cfa0e891274a0b4b5cc3947c1e36fe`。新旧提交 patch-id 均为
`ed9dd2bbf28d48af6c6836fc4362a450f3b9f0e0`，证明重切未改变 P1 补丁语义。
之后按用户后续明确裁决合入 `feature-chaotang-ext`。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 后端规范事实源是 `departments.yaml` 的 `v1_taxonomy` | `backend/harness/chaotang_department_protocol/departments.yaml` | SSOT 单测与 golden routing | 否 |
| 已确认事实 | 前端规范事实源是 `dept.ts` | `frontend/src/lib/contracts/dept.ts` | nodetest 与仓库 grep guard | 否 |
| 已确认事实 | 重切补丁与旧提交语义等价 | 两提交 `git patch-id --stable` 输出相同 | Git 历史复核 | 否 |
| 未知问题 | 浏览器完整旅程是否能在当前宿主启动 | 不适用 | 本 change 的 smoke 步骤确认 | 验收前待定 |

## 数据流与调用链

后端：`departments.yaml` → `department_identity.py` → router / persona / engine / 四司与
朝臣注册表一致性检查。

前端：`dept.ts` → ministry、unified registry、page view、swarm、decision ledger、
prompt suggestion 与 department-learning 消费者。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 后端部门 taxonomy | `backend/harness/chaotang_department_protocol/departments.yaml` | `backend/src/department_identity.py` 及后端消费者 | 重复命名空间 fail-closed；golden 路由保持不变 |
| 前端部门 ID 与投影 | `frontend/src/lib/contracts/dept.ts` | 前端注册表、页面与 swarm 合约 | nodetest、grep guard、TypeScript 编译 |

## 范围

- 收敛六部及关联四司的身份定义与派生映射。
- 拒绝未知或重复的规范 key。
- 保持既有路由含义、API 线格式与页面行为不变。
- 恢复 P1 的 change 证据目录并在 EXT 上完成验收。

## 非目标

- 不新增部门、不重命名公开 API 字段。
- 不改变 Chancellor 路由算法或 golden case 预期。
- 不开展 census 修订、EXT 三证、release 分支工作或 P2+ 功能实现。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| YAML 出现重复 canonical/route/office key | 加载时拒绝，不能静默覆盖 | `test_department_identity_ssot.py` |
| 四司或朝臣配置引用未知部门 | 显式拒绝 | `test_department_identity_ssot.py` |
| 前端消费者重新硬编码六部词汇 | repository grep guard 失败 | `dept-ssot.nodetest.ts` |
| 路由回归 | 30 条 golden case 全部保持通过 | `test_chancellor_golden_cases.py` |

## 风险与回滚边界

主要风险是映射收敛遗漏消费者，造成导入时失败、路由漂移或前端 bundle 类型错误。
回滚以 P1 merge commit `defd157739ab1815eafeccfe420348ab452eae1a` 为边界，使用
非破坏性的 `git revert -m 1 defd157739ab1815eafeccfe420348ab452eae1a`；不得改写
共享 EXT 历史。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-14
- 批准范围：P1 重切、change 重建、完整验收；后续明确批准合入 EXT 并在 EXT 继续
- 明确未批准：push、release 分支动工、P2+ 功能实现

## 验收标准

- 后端与前端 SSOT 守门测试通过。
- Chancellor golden routing 30 条通过。
- 根、前端、后端三层 doctor 通过。
- 前端 TypeScript 编译通过。
- 后端代表性 43 项套件通过，生产数据库哈希不变。
- 浏览器走完“上书房下旨 → 军机处状态 → 御前裁决 → 史官归档”；若服务无法安全
  启动，必须记录 `SMOKE_NOT_RUN(reason)`，不得静默跳过。

## 验证计划

所有命令的精确工作目录、起止时间、退出码、覆盖范围和未验证项写入
`ci_result/ci_summary.md`，浏览器产物写入本 change 的 `ci_result/artifacts/`。
