# 主开发机环境审计 - 2026-06-17

> 目的：把这台机器变成安全、清晰、顺畅的主开发环境。本文只记录可验证事实、操作边界和最小验收链，不保存任何密钥值。

## 1. 当前可信源

主仓锚点：

- 前端主仓只认：`/home/ubuntu/workspace/frontend/chaotang-web-lyt`，remote `git@gitee.com:msxn/chaotang-web-lyt.git`。
- 后端 jiqun 主仓只认：`/home/ubuntu/fe/fengQun/jiqun_ai_fresh`，remote `git@gitee.com:msxn/jiqun_ai.git`。
- 旧 worktree、`chaotang-os`、`court-agent-os`、其它相似目录只作历史参考；没有明确指令，不在第三个目录开发、验证、提交或合并。

### 前端主仓

- 路径：`/home/ubuntu/workspace/frontend/chaotang-web-lyt`
- remote：`git@gitee.com:msxn/chaotang-web-lyt.git`
- 当前分支：`feat/libu-chro-cao-contract`
- 当前 HEAD：`b27594b feat(libu): 自适应复杂度运行时 - 风险地板从声明变代码`
- 本地 `master`：`1e93306 [shared] merge feat/courtos-loop-harness into master`，与 `origin/master` 对齐。
- 本地 `feat/courtos-loop-harness`：`73db1e5`，与 `origin/feat/courtos-loop-harness` 对齐。
- 远端更新状态：2026-06-17 `git fetch origin` 已恢复成功，`origin/master`、`origin/feat/courtos-loop-harness`、`origin/fusion/chaotang-web-latest-20260616` 等引用已刷新。
- 合并边界：当前 feature 分支无上游且工作区有并发改动，只做 fetch，不在 dirty 状态下直接 pull/merge。

### 后端 jiqun 主仓

- 路径：`/home/ubuntu/fe/fengQun/jiqun_ai_fresh`
- remote：`git@gitee.com:msxn/jiqun_ai.git`
- 当前分支：`feat/courtos-loop-harness`
- 当前 HEAD：`9c405e7 feat(loop): 落地 Loop+Harness 后端引擎 - 确定性决策/产线 loop + 六部 swarm skills`
- 该分支与 `origin/feat/courtos-loop-harness` 对齐。
- 本地 `master`：`c00b36e chore: rename mentor role to qintianjian`，显示相对 `origin/master` ahead 266 / behind 1。
- 远端更新状态：2026-06-17 `git fetch origin` 已恢复成功，新远端引用包括 `origin/fusion/jiqun-ai-latest-20260616`、`origin/integration/chaotang-orchestration-v1`、`origin/backup/backend-master-local-20260616` 等。
- 合并边界：当前分支已与自己的 upstream 对齐；`master` 与 `origin/master` 历史分叉很大，不在运行数据 dirty 状态下直接 pull。

### 最新 PRD

- 桌面文件：`/mnt/c/Users/admin/Desktop/PRD_PM_CourtOS_2026-06-13(1).md`
- 仓内同步版：`docs/PRD_PM_CourtOS_2026-06-13.md`
- 核心判断：
  - 不是古风角色扮演，不是部门导航站。
  - MVP 只验收一条真闭环：上书房提出真实问题 -> 军机处组织会审 -> 输出圣旨/奏折 -> 用户裁决 -> 史馆归档 -> 后续可引用。
  - 圣旨/奏折必须包含：圣裁、分奏、证据、风险、后令、质门、来源。
  - 前台只呈现一道结果，不让用户管理 agent/蜂群。

## 2. 当前运行面

| 服务 | 端口 | 状态 | 说明 |
|---|---:|---|---|
| 前端 dev | 3002 | running | `next-server v16.2.6`, PID `906885` |
| 前端 prod | 3050 | running | `next-server v16.2.4`, PID `1994770`，生产端口未动 |
| 后端 jiqun | 8081 | running | `python -m web.main`, PID `1878570` |
| LiteLLM/本地网关 | 4444 | running | 后端 health 已探通 `/v1/models` |
| 后端 health 旧探针 | 4000 | down | 已不再作为当前 dev health 默认探针 |
| Ollama | 11434 | running | 本地模型：`qwen3:4b` |
| Redis | 6379 | running | 本机监听 |
| MySQL | 3306 | running | 本机监听 |

健康结果：

- `http://127.0.0.1:3002/chaotang/api/health`：`status=ok`，jiqun、swarm config、task registry、legal agent 均 ok。
- `http://127.0.0.1:8081/api/health`：`status=ok`，`mcp_web_search=up`，`litellm=up`，`deepseek_key=configured`。

端口纪律：

- dev 固定 `3002`。
- production 固定 `3050`。
- 禁用 `3001`。
- 不要用 dev 进程占 `3050`，不要杀生产 PID，除非明确执行生产重启流程。

## 3. 当前工作区改动

前端 dirty：

- `config/departments.registry.yaml`
- `package.json`
- `src/core/courtos/unified/department-registry.ts`
- `src/core/courtos/unified/unified-decision-loop.ts`
- `src/core/courtos/unified/unified-loop.nodetest.ts`
- `src/core/courtos/unified/unified-types.ts`
- untracked：`.claude/agents/`
- untracked：`.claude/skills/`
- untracked：礼部/礼仪/刑部 registry 与 adaptive complexity profiles（`config/rites_*`, `config/ritual.*`, `config/xingbu_*`）
- untracked：礼部/礼仪/刑部 evals、loops、adaptive loops、prompts
- untracked：礼部/礼仪/刑部 schema，包括 `Rites*`、`Ritual*`、`Xingbu*`、`Company*Profile*`
- untracked：礼部/礼仪/刑部合同与 adaptive 校验脚本（`scripts/validate-*.mjs`）

后端 dirty：

- `data/fengqun.db`
- `scripts/serve-dev.sh`
- `harness/chaotang-true-loop/golden_cases/true_loop_cases.json`
- untracked：`_patch_golden.py`

安全结论：

- 现在不能做 `git reset`、不能 `git add .`、不能直接切回 master 合并。
- 需要先按文件级分拣，把前端吏部/礼部/刑部合同层、统一 loop runtime、后端 dev health 修复、运行数据分开提交或快照。
- 2026-06-17 晚间前端分支曾由并发工作切换到 `feat/libu-chro-cao-contract`，后续操作必须以当前分支为准，不假定仍在旧分支。

## 4. 环境变量表面

只记录键名，不记录值。

前端 `.env.local`：

- `NEXT_PUBLIC_API_MODE`
- `NEXT_PUBLIC_V1_API_URL`
- `COURTOS_API_URL`
- `LEGAL_AGENT_BASE_URL`
- `JIQUN_BASE_URL`
- `JIQUN_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`

后端 `.env` / `.env.example`：

- `LITELLM_PROXY_KEY`
- `DEEPSEEK_API_KEY`
- `FENGQUN_AUTH`
- `FENGQUN_JWT_SECRET`
- `PORT`
- `NO_PROXY`
- `MINIMAX_API_KEY`
- `MINIMAX_CN_API_KEY`
- `ZHIPU_API_KEY`

风险：

- 已修复：`scripts/serve-dev.sh` 会加载 `.env` 后设置 `LITELLM_BASE=http://127.0.0.1:4444`，并把 `LITELLM_PROXY_KEY`/`LITELLM_MASTER_KEY` 映射给 health 使用的 `LITELLM_API_KEY`。不要在文档或日志中打印任何 key 值。

## 5. 数据、缓存、运行产物边界

前端本地数据/日志：

- `.chaotang-main-dev.db`
- `.chaotang-ledger-dev.db`
- `.next/dev/logs/next-development.log`

后端本地数据：

- `data/fengqun.db`
- `memory/state.db`
- `knowledge/chroma_db/chroma.sqlite3`

缓存/依赖：

- 前端：`node_modules/`, `.next/`
- 后端：`.venv/`, `.pytest_cache/`, `__pycache__/`

规则：

- `.db` 文件按运行数据处理，不和代码一起混提交，除非任务明确要求迁移样本数据。
- `.next/`, `node_modules/`, `.venv/`, `__pycache__/`, `.pytest_cache/` 只作为本机运行产物。
- 旧文件按时间区分不够，必须再按路径和 Git 跟踪状态区分。

## 6. 最小验收链

已完成验证：

- 前端 `npm run build`：通过。
- 前端 `npm run test:core`：102 passed。
- 前端 `npm run eval:rites`：通过，19 files / 20 golden cases。
- 前端 `npm run eval:rites:adaptive`：通过，6 files / 20 golden cases / 5 modes / 9 escalation rules。
- 前端 `npm run eval:ritual`：通过，当前复用 `validate-rites-contracts.mjs`，19 files / 20 golden cases。
- 前端 `npm run eval:xingbu`：通过，21 files / 20 golden cases。
- 后端相关 pytest：
  - `tests/test_shangshufang_loop_api.py`
  - `tests/test_swarm_execution_loop_api.py`
  - `tests/test_chaotang_department_submit.py`
  - `tests/test_task_protocol_api.py`
  - `tests/test_resource_consolidation.py`
  - `tests/test_yushi_drift_monitor.py`
  - 结果：24 passed。
- 浏览器验证 `/chaotang/court-briefing`：通过，截图 `/tmp/court-briefing-center-inspect.png`。

本地安全快照：

- 路径：`/tmp/courtos-safety-20260617`
- 前端状态：`frontend-status.txt`
- 前端 tracked diff：`frontend.diff`
- 前端 untracked 清单：`frontend-untracked.txt`
- 前端 untracked 内容包：`frontend-untracked.tgz`
- 后端状态：`backend-status.txt`
- 后端 tracked diff（排除运行数据库）：`backend-no-db.diff`
- 后端 untracked 清单：`backend-untracked.txt`
- 后端 untracked 内容包：`backend-untracked.tgz`

建议每次融合后固定跑：

```bash
npm run test:core
npm run build
```

后端主线相关变更后固定跑：

```bash
.venv/bin/python -m pytest tests/test_shangshufang_loop_api.py tests/test_swarm_execution_loop_api.py tests/test_chaotang_department_submit.py tests/test_task_protocol_api.py
```

视觉/闭环类变更后跑浏览器 smoke：

```bash
node /tmp/chaotang-center-inspect.mjs
```

## 7. 当前产品主线映射

PRD 主链：

```text
上书房提出真实问题
-> 军机处组织会审
-> 输出圣旨/奏折
-> 用户裁决
-> 史馆归档
-> 后续可引用
```

当前代码对应：

- 上书房页面：`/chaotang/court-briefing`
- 上书房 BFF：`src/app/api/court/shangshufang/*`
- 军机处/决策入口：`/chaotang/throne/decision`, `src/app/api/court/decision/route.ts`
- 圣旨展示壳：`src/features/shangshufang/components/MemorialScroll.tsx`
- 史馆页面：`/chaotang/archive`, `/chaotang/shiguan`
- 史馆 API：`src/app/api/court/shiguan/*`
- 后端 jiqun 新主线：`web/routers/shangshufang.py`, `web/routers/swarm_runs.py`, `src/shangshufang_loop.py`, `src/swarm_execution_loop.py`

已完成的产品修正：

- 圣旨首屏固定为：`御前摘要 / 红线 / 回奏精华 / 丞相建议 / 附件明细`。
- 详细分奏、证据、路由与来源默认收进附件，不再压住首屏动作。
- `王公公` 已不是运行主线概念；当前后端和协议主线使用 `钦天监`。前端 `DESIGN.md` 仍有历史文档残留，需要后续文档清理。

## 8. 最高优先级后续动作

1. 按文件级分拣当前 dirty/untracked：先保护并发工作，不做 `git add .`。
2. 将后端 `.db` 运行数据从代码改动里隔离，避免误提交。
3. 继续清理历史 `4000` 默认值：当前 dev health 已转 `4444`，但部分脚本仍保留旧默认值，后续按使用面逐个迁移。
4. 远端代码已能 fetch；真正融合前先基于 clean worktree 做显式 merge/rebase 方案，逐分支验收。
5. 按 PRD 主链继续融合：先闭环，不继续扩页面。

## 9. 操作铁律

- 先验收，再融合。
- 只信当前分支、当前服务、当前 PRD、当前测试结果。
- 任何远端合并前必须先 `fetch` 成功并看清 ahead/behind。
- 任何生产动作前先确认 `3050` PID 和 nginx upstream。
- 任何真实资金、合同、报价、交付、对外承诺事项必须走后端 jiqun 主线和人工确认，不在前端咨询 runtime 里自作产线闭环。
