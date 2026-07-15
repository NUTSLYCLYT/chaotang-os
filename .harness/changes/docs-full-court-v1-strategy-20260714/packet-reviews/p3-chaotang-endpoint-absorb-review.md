# Packet P3 整包审查报告：refactor-chaotang-endpoint-absorb-20260715

| 绑定项 | 值 |
| --- | --- |
| BASE_SHA | `d79b73a`（merge-base 实测，= 上一 GO 后 ext HEAD，前驱链正确） |
| HEAD_SHA | `ee89259b0ef8a123ac13dc2d4b1032a177ffbc88`（P3a–e 五 checkpoint 之末） |
| branch / worktree | `task/p3-chaotang-endpoint-absorb` / `~/Projects/.fullcourt-worktrees/p3-chaotang-endpoint-absorb` |
| change ID | `refactor-chaotang-endpoint-absorb-20260715` |
| 工作树状态 | **脏**（models.py+2 测试未提交，Codex 在途）——本审查在独立 detached worktree `review-p3-ee89259` 上对已提交 HEAD 执行，不受在途改动污染 |
| push 暴露 | ls-remote task/* = 0 条（`CHECK_AT=2026-07-15 09:46:56 CST`，时点查询口径） |
| 审查 diff 范围 | `d79b73a..ee89259`（5 提交） |
| ext merge | 未合入 ✓（停审门遵守） |
| 真实 DB | `10dbcf48…` 与 P0 基线一致（复核于测试后） |

## 独立复核（detached worktree @ ee89259，时间戳取自命令输出）

| 项 | 结果 | 判定 |
| --- | --- | --- |
| P3 测试电池（tripwire/架构/投影/direct 派发/daemon gate/memorial adapter/scribe×2） | 43 passed | PASS |
| 代表主链套件（+closed_loop） | 75 passed / 1 deselected | PASS |
| tsc --noEmit | 0 errors | PASS |
| 前端全量 nodetest | 1028 tests：1021 pass / **7 fail 与台账基线逐名一致，零新增** | PASS |
| 三层 doctor | 0 errors | PASS |

## 五子步逐项结论

- **P3a** scribe 双读切 canonical ✓；throne 冻结边界守住，DEFERRED 登记带复核命令 ✓
- **P3b** taskDetail/stream → canonical 事件投影；前端同形状 adapter 无第二状态机；投影模块 `_owned_task` 三处读全部校验 owner（兼容桥安全边界兑现）✓
- **P3c** direct/manor 派发走 outbox；canonical 事务完整（compat 建任务/幂等路由/timeline 幂等/入队）；direct.py 无 F1 同类丢参（请求本无约束字段）✓
- **P3d** daemon 以 feature gate 关闭而非物理拆——正确遵守"无计数证据不物理拆"门 ✓
- **P3e** 四个 `*-p3-pending` 生产 writer 白名单条目全部清除，仅剩 pytest 专用（FENGQUN_TEST_DB_GUARD 门）——legacy 生产写全面 fail-closed ✓

## 阻塞项（唯一）

**P3-F1（HIGH，见 p3-prereview-findings.md）未修复**：`canonical_court_dispatch.py`
constraints/budget/stakes 零命中——chaotang 派单默认路径仍静默丢弃用户设定的
预算/部门/风险约束并回 `ok`。修复方向三选一与验收标准已在发现文件。

## 附带条件（不阻塞，须在 change 记录处置）

- P3-Q1：`direct_completed` 入队即置——已核实继承自 canonical shangshufang
  现行语义（ING-04 ADR 缺口），change 记录注明继承关系即可；
- P3-Q2：EmperorDecision 新构造点（compat_court_dispatch）登记进 DEC-01
  收口构造点清单；
- 在途脏改动（models.py 等）须形成独立 commit 后走增量复核，不得混入
  已审 HEAD 的合并。

## 裁决（v1，HEAD `ee89259` 时点）

PACKET_REVIEW_NO_GO（阻塞清单：仅 P3-F1）

## v2 增量复审（HEAD `5a4c712`）

初审后分支新增三笔：
- `a82dab0`/`77434a6`：append-only 归档结果投影——`ArchiveOutcomeEvent`
  事件表（alembic 011+回填脚本），census ARCH-03 推荐 canonical owner 的
  原样落地，填补 P3e 退役 legacy retrospective writer 后的结果落点。
  登记要求：alembic 011 计入 P5 认知；新数据对象入主链骨架图（census 修订带上）。
- `5a4c712`：**F1 修复**——`build_compat_dispatch_constraints` 规范化约束：
  departments（ministers/groups→canonical 部门）经 `_apply_department_override`
  真实写入路由事实（mode 重算+来源注记+compat_constraints 入档）；
  budget/stakes≠low/mode≠live 及未知 minister/group 一律
  `UnsupportedCanonicalConstraints` 显式拒绝，router 捕获后 fail 带原因——
  零静默丢弃。审查者重跑 gate/dispatch/decision-fact 测试 12 passed。

F1 验收三类字段全满足（真实尊重或显式拒绝+测试覆盖）。**F1 关闭。**

## 裁决（v2，最终）

PACKET_REVIEW_GO

条件：Q1 继承关系与 Q2 构造点登记已随 spec/deferred-boundaries 更新核实在档；
合 ext 后 alembic 011 与 ArchiveOutcomeEvent 的登记项由 census 修订承接。
