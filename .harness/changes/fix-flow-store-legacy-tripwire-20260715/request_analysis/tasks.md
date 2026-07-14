# 任务：fix-flow-store-legacy-tripwire-20260715

## 任务 1：fail-closed writer registry

- 目标：7 个 flow-store 写入口及 chaotang-store 双写在 mutation 前校验精确 writer/operation。
- 前置条件：P1 已在 EXT，P2 worktree 基于 `cbbe5e2`。
- 输入：P2 frozen plan、`d990a47` 既有 blocked registry 模式。
- 输出：runtime registry、生产调用身份、test-only identity、rollback switch。
- 涉及文件：`backend/src/legacy_write_tripwire.py`、`flow_store.py`、`chaotang_store.py` 及调用点。
- 状态 / 数据变化：默认收紧旧表/JSON 写；不迁移数据、不写生产 DB。
- 验证命令与证据：tripwire RED→GREEN；既有 flow/closed-loop 回归。
- 回滚边界：`FENGQUN_LEGACY_WRITE_TRIPWIRE=0` 临时旁路并计数。
- 完成定义：缺失/未知/越权均零 mutation；精确白名单落盘。
- 状态：完成。

## 任务 2：内存事实源处置与迁移观测

- 目标：governance bills 持久化复用 `DecisionTask`；退役重复 IMA compat 路由；canonical/legacy 指标可读。
- 输出：`governance_compat_store.py`、三类 canonical 计数、chaotang legacy endpoint/store 计数。
- 完成定义：bill 经模块重载仍存在；IMA 路由无重复；零值与非零指标均有证据。
- 状态：完成。

## 任务 3：常驻架构守门

- 目标：阻止新增后端 legacy writer import、前端 attic/本地决策引擎 import。
- 输出：pytest AST gate、Node import gate、阳性违规 fixture。
- 完成定义：当前精确白名单通过；两个违规 fixture 均被拒绝；进入常规测试 profile。
- 状态：完成（前端以既有 Node test profile 的等价静态守门实现；仓内无 ESLint 依赖）。
