# 主线融合吸收台账 — 2026-06-29

> 交接给做 `feat/port-from-fresh` fusion 的 owner。本台账记录:哪个是主线/最新、缺口分析、
> 已吸收什么、做了哪些契约决策、什么刻意没吸收。结论:**`jiqun_ai_fresh` 应作主线基线,而非反向。**

## 1. 裁决:主线 vs 最新

| | 是什么 | 角色 |
|---|---|---|
| `origin/master`(= 本地 `~/fe/fengQun/jiqun_ai`) | **压扁快照**,全史仅 ~32 commit,根 2026-06-13,尖 06-28 10:11 | Gitee 名义主线,历史浅 |
| `~/fe/fengQun/jiqun_ai_fresh` | **完整 343+ commit 史**,根 2026-04-03,尖 06-29,8081 实跑 | **最新 + 源码真相,应作 base** |

- `git merge-base HEAD origin/master` → **无共同祖先(0 共享 commit)**:两条平行历史,**不能 merge,只能逐文件 port / cherry-pick**。
- 与既有记忆一致:"jiqun_ai 远端是压扁快照,本地 jiqun_ai_fresh 才是源码真相"。
- **方向铁律:最新(fresh)吸收老(快照),不可反向**——反向会把完整史压扁、丢 343 提交真相。

## 2. 缺口分析(两树差集)

- `origin` 树有、`fresh` 树没有的文件:**33 个**;`fresh` 有、`origin` 没有:**113 个**(fresh 压倒性超集)。
- 33 个里**唯一真实功能缺口 = 户部真实财务数据导入套件**;其余为 agent_design 文档(~20,非运行时)+ 运行产物(knowledge/flywheel、reports、cases、absorption ledger)。
- 其它看似"独有"的 origin 提交(final_output 救活蜂群 / persist task / signoff 治理 / shiguan 加固 / hubu 路由)**fresh 早有同类实现**(平行 SHA),已逐项核实。

## 3. 已吸收:户部财务导入套件(commit `d91fab3`)

port 进 fresh 的 24 文件:`src/hubu_finance_csv_loader.py`、`src/hubu_real_data_importer.py`、
`src/hubu_financing_gate.py` + 3 脚本 + `templates/hubu_finance_import/*.csv`(10) + 6 测试 + 2 文档。

### 吸收时做的 4 处契约决策(均采 **fresh** 契约,因 fresh 为最新基线)
1. **reporting verdict 词表**:fresh = `healthy/blocked/watch`(`src/hubu_financial_reporting.py:318`);origin 移植版用 `ready`。→ 采 fresh。
2. **reporting factpack caseId**:fresh 复用原 caseId;origin 加 `-reporting` 后缀。→ 采 fresh(不加后缀)。
3. **货币值格式**:fresh = 2 位小数串(`"800000.00"`);origin = 整数串(`"800000"`)。→ 采 fresh。
4. (以上导致 origin 移植测试 3 处断言适配为 fresh 词表,代码逻辑未改。)

> ⚠️ owner 复核点:若 origin 的 `ready` / `-reporting` 后缀 / 整数格式是**有意语义**,需在 fusion 时回看。本台账已采 fresh。

## 4. 刻意未吸收

- `tests/test_shiguan_prompt_batch_mode.py`:**非缺口**。fresh 已有 shiguan batch 代码 + 75 个自有 shiguan/archive/flywheel 测试通过;origin 该测试是旧措辞,引入只会噪声失败。
- `agent_design/buildAgent/三省六部体系/**`(~20 文档)、`knowledge/flywheel/*.json`、`reports/*.html`、`cases/approved/*.json`、`docs/mainline_absorption_ledger_2026-06-22.md`:文档/运行产物,按 AGENTS.md 不进功能吸收。

## 5. 本会话其它修复(7 commit,在 fresh master `41d3abc`..`d91fab3`)

- `fix(chaotang)`:tasks_list 不再静默吞 DB 错误 + 删死代码(后端真改动)。
- 5 个测试卫生修复:registry 过时断言 / swarm double 契约 / finance 守真财报 / 持久化 mock / UI hermetic 隔离。
- 让原 8 个红测归零。

## 6. 验证

- 全量:**1620 passed / 6 skipped / 0 failed**(`.venv/bin/python -m pytest -q`,python3.14 + litellm 1.83.7)。
- 环境依赖:embedding 走 ollama `nomic-embed-text-v2-moe`(本机已 pull;**CI/上线机需各自 pull**)。

## 7. 建议

以 `jiqun_ai_fresh` 为主线基线。本次完整状态已推分支 **`mainline-from-fresh-complete`** 供 review,
未 force-push、未动 `origin/master`、未碰 `feat/port-from-fresh`。
