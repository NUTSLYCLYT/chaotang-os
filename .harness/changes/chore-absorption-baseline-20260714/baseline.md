# P0 吸收前基线（BASE 2a92646 重切版）

记录日期：2026-07-14（Asia/Shanghai）

## 1. Bootstrap 与分支绑定

| 项 | 值 |
| --- | --- |
| campaign BASE_SHA | `2a92646cbae6c411a48a5a9a72257e7ac188e49f` |
| migrated bootstrap / predecessor | `f9b3e88668cfa0e891274a0b4b5cc3947c1e36fe` |
| plan SHA-256 | `9d4a0cf1bdcaa3edc190acbfb0cf23b4941bb47917f5b9be76d979f01cd9db9b` |
| integration worktree | `/tmp/chaotang-base-migration`，`integration/full-court-v1` |
| P0 worktree | `/tmp/chaotang-p0-v2base`，`task/p0-absorption-baseline` |
| old integration/P0 | 以 `archive/*-pre-2a92646` 分支保留，可恢复 |
| original ext worktree | `/home/ubuntu/Projects/chaotang-os`，dirty，未修改 |
| push/upstream | 均无 |

P0 分支创建时 clean；创建 change 后 `git status --short` 仅出现本 change 目录。

## 2. 运行环境与 capability

- Python 3.14.4；Node 22.23.1；pnpm 10.33.0。
- socketpair preflight：`socketpair_send=1`，当前 runner 能运行 TestClient/tsx。
- P0 worktree 初始无 `frontend/node_modules`；离线安装复用 144 包、下载 0 包、忽略安装脚本，lockfile 无变化。
- 仓库测试基础设施修复：`NONE`。

## 3. 真实控制面 DB 前后指纹

目标：`/home/ubuntu/Projects/chaotang-os/backend/var/data/fengqun.db`

| 时点 | size | mtime | SHA-256 |
| --- | ---: | --- | --- |
| 测试前 | 2121728 | `2026-07-12 21:41:04.872473901 +0800` | `10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2` |
| 测试后 | 2121728 | `2026-07-12 21:41:04.872473901 +0800` | `10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2` |

P0 worktree 的 legacy/current 两个候选路径均不存在；测试没有创建或修改控制面 DB。

## 4. 后端基线

| 项 | 结果 |
| --- | --- |
| backend doctor | 0 errors / 0 warnings |
| production DB tripwire | 5 passed in 3.39s |
| canonical 主链代表套件 | 43 passed / 1 deselected in 5.70s |
| full collect-only | 2589 tests in 7.00s |
| 无选择 full pytest | `NOT_RUN_SAFETY_BLOCKED` |

代表套件继续排除真实 LLM 字面量断言 `chancellor_chat_streams_single_agent_reply`。无选择全量 pytest 在 legacy 裸 sqlite/Node/E2E/脚本生产路径 tripwire 完成前不得运行。

## 5. 前端基线

| 项 | 结果 |
| --- | --- |
| frontend doctor | 0 errors / 0 warnings |
| TypeScript | PASS |
| complete node suite | 1009 tests；1002 pass / 7 fail；6.12s |
| lint | `MISSING` |

7 个失败与旧 P0 完全相同，均只记录不修：v1 状态断言、3 个退役 BFF 文件引用、bureau 名称差异、退役 dispatch route 数量守门，以及其余退役 learning/orchestrate 文件引用。

## 6. P7 对账 KPI 基线

P7 必须原样使用本口径：

| KPI | 新 P0 | 旧 P0 | 说明 |
| --- | ---: | ---: | --- |
| 生产源码 LOC | 238894 | 238743 | `git ls-files backend/src backend/web frontend/src` 中 py/ts/tsx/js/jsx/mjs 的 `wc -l` |
| legacy 写入口候选 | 10 | 10 | `backend/src/db/flow_store.py` 7 + `backend/src/chaotang_store.py` 3 |
| legacy 核心文件 LOC | 4404 | 4404 | flow_store 950 + chaotang_store 308 + chaotang router 2166 + orchestrator 980 |
| 前端本地二级状态机定义文件 | 5 | 5 | ministry review、yushitai、imperial synthesis、red-blue、unified loop |
| 上述 5 文件 LOC | 1149 | 1149 | 106 + 72 + 108 + 145 + 718 |
| 部门命名体系 | 4 套 | 4 套 | P1 目标后端/前端双 SSOT |
| 部门注册表副本 | `>=7` | `>=7` | P1 机器守门后重算 |
| 部门码→AgentCode 副本 | `>=5` | `>=5` | P1 目标后端 1 + 前端 1 |
| canonical/legacy 流量 | `NO_COUNTER_BASELINE` | 同 | P2 才建立观测 |

结构重构相对旧 P0 的生产源码净增为 151 LOC；这是新 campaign 基线，不归因于后续 Packet。

## 7. Deferred / 安全阻塞

- `NOT_RUN_SAFETY_BLOCKED`：无选择后端全量 pytest 未运行，campaign 最终不得宣称 DONE。
- `NO_COUNTER_BASELINE`：P2 前无流量曲线，P3 只能 flag 关闭旧链，不能物理拆。
- P0 免统一浏览器冒烟。
- 7 个前端失败和 lint 缺失仍是显式红灯基线，后续 Packet 不得顺手修复。
