# Codex + Claude Code Launch Workflow Playbook

Date: 2026-06-08

Purpose: give the team a concrete, repeatable workflow for using Codex and
Claude Code together to summarize all Chaotang project material, repair the true
loop, and prepare for launch.

## Decision

Use a lightweight, human-approved workflow:

```text
Claude Code = review room, synthesis, architecture/product/security critique
Codex = local execution, code changes, tests, browser QA, build, release evidence
Harness/golden cases = objective gates
Human = final scope, irreversible decisions, launch approval
```

Do not run a fully autonomous workflow from "collect material" to "deploy".
The project still has demo/fallback/legacy material mixed with live paths, so
each stage needs evidence and a stop/go gate.

## Workspace Rule

Do not develop everything in one folder.

Use one folder per source of truth:

| Work type | Mainline folder | Ports | Rule |
|---|---|---|---|
| Frontend, Next.js, UI, browser QA, release pages | `/home/ubuntu/workspace/chaotang-web-lyt` | dev `3002`, prod `3050` | Frontend changes only |
| Backend, FlowEngine, swarms, harness, governance, Python | `/home/ubuntu/workspace/jiqun_ai` | `8081` | Backend/harness changes only |
| Codex global rules, local skills, plugin health | `/home/ubuntu` | N/A | Only durable operating rules |
| Legacy reference | `/home/ubuntu/chaotang-os` | N/A | Read-only source material until explicitly migrated |

Cross-repo changes are allowed only as separate stages:

```text
finish frontend evidence -> stop -> switch repo -> finish backend evidence
```

Never mix frontend commits with backend/harness commits.

## Workflow Overview

| Stage | Goal | Claude Code role | Codex role | Gate |
|---|---|---|---|---|
| 0. Start gate | Confirm goal, user, success metric, smallest useful ship | Challenge scope | State repo, ports, verification | No vague launch target |
| 1. Collect dossier | Summarize current docs, legacy repo, tests, risks | Synthesize and find contradictions | Generate file inventory and master dossier | Dossier has source/status/target |
| 2. Decide scope | Freeze launch product and non-goals | Product/strategy debate | Turn decision into docs/checklist | One true loop selected |
| 3. Freeze contract | Define `LaunchLoopCase` and true-loop fields | Review contract and edge cases | Write schema/golden case/tests | pytest contract passes |
| 4. Repair backend | Fix true-loop semantic mismatch | Review risk and data boundaries | Implement smallest backend fix | focused pytest passes |
| 5. Verify frontend | Prove UI consumes contract honestly | Review UX clarity and trust labels | Playwright, screenshots, build | E2E + build pass |
| 6. Release gate | Decide GO/NO-GO | Security/product/ops review | health, release harness, evidence report | no critical blockers |
| 7. Archive learning | Preserve decisions and failures | Summarize lessons | Write 史馆/release ledger | next action recorded |

## Stage Prompts

Each stage has a Claude Code prompt and a Codex prompt. Use Claude first when
the task is ambiguous, architectural, strategic, or high-risk. Use Codex first
when the task is concrete and verifiable.

### Stage 0: Start Gate

Claude Code prompt:

```text
你是 Chaotang 上线会审室。请用产品、架构、安全、运维四个视角审视本轮目标：

目标：汇总项目资料，修正真闭环，准备上线。
主线产品：先知和导师最小真闭环。
已知主线：
- 前端 /home/ubuntu/workspace/chaotang-web-lyt
- 后端 /home/ubuntu/workspace/jiqun_ai
- legacy /home/ubuntu/chaotang-os 只读参考

请输出：
1. 本轮最小可上线范围。
2. 明确不做什么。
3. 最大 5 个上线阻断风险。
4. 给 Codex 的执行指令，必须可验证。
```

Codex prompt:

```text
按顶级 Codex 工作流执行。

目标：确认本轮上线工作目标、主线仓库、端口、验证命令和最小可交付物。

规则：
- 前端只用 /home/ubuntu/workspace/chaotang-web-lyt，dev 3002，prod 3050。
- 后端只用 /home/ubuntu/workspace/jiqun_ai，端口 8081。
- /home/ubuntu/chaotang-os 只读，不删除，不整仓复制。
- 先列验证命令，再执行。

输出：
- repo/ports/verification 表。
- 本轮 stop/go gate。
- 下一步最小动作。
```

### Stage 1: Collect Dossier

Claude Code prompt:

```text
请审阅当前项目资料并生成“上线资料总纲”的结构建议。

重点资料：
- chaotang-web-lyt/docs
- jiqun_ai/docs
- jiqun_ai/harness
- /home/ubuntu/chaotang-os/docs
- true-loop 相关测试和文档

请不要写代码。请输出：
1. 资料分类法。
2. 哪些资料是上线依据，哪些只是 legacy 参考。
3. 哪些资料互相冲突。
4. 给 Codex 的文件生成任务。
```

Codex prompt:

```text
按顶级 Codex 工作流执行。

目标：生成 MASTER_LAUNCH_DOSSIER_2026-06-08.md。

请读取并汇总：
- /home/ubuntu/workspace/chaotang-web-lyt/docs
- /home/ubuntu/workspace/jiqun_ai/docs
- /home/ubuntu/workspace/jiqun_ai/harness
- /home/ubuntu/chaotang-os/docs
- true-loop 测试和运行证据

输出文件放在：
/home/ubuntu/workspace/chaotang-web-lyt/docs/MASTER_LAUNCH_DOSSIER_2026-06-08.md

每条资料必须有：
- source path
- status: PROD / FIX / DEMO / LEGACY / REJECT
- value
- risk
- target repo
- next action

不要修改产品代码。最后给 Git 状态和验证结果。
```

### Stage 2: Decide Scope

Claude Code prompt:

```text
请作为产品/架构/安全会审，基于 MASTER_LAUNCH_DOSSIER 判断最终上线范围。

必须回答：
1. 最终上线产品一句话是什么？
2. P0 必须包含哪些页面/API/后端能力？
3. 哪些页面只能标 DEMO？
4. 哪些能力上线前必须隐藏或降级？
5. 最小用户成功路径是什么？

输出给 Codex 的 scope freeze 文档任务。
```

Codex prompt:

```text
目标：冻结上线范围，更新 launch scope 文档。

请基于：
- MASTER_LAUNCH_DOSSIER_2026-06-08.md
- TRUE_LOOP_MAP_2026-06-08.md
- CHAOTANG_FINAL_LAUNCH_AND_OS_ABSORPTION_PLAN_2026-06-08.md

生成或更新：
/home/ubuntu/workspace/chaotang-web-lyt/docs/RELEASE_SCOPE_FINAL_2026-06-08.md

必须包含：
- P0/P1/P2
- 不上线清单
- DEMO/FALLBACK/LIVE 标签规则
- GO/NO-GO 闸门
- 验证命令
```

### Stage 3: Freeze Contract

Claude Code prompt:

```text
请审查 LaunchLoopCase 契约设计。

目标链路：
Shangshufang command
-> backend study/run
-> task/run/decision id
-> command center next action
-> Shiguan archive outcome
-> lesson + next_signal

请输出：
1. 必填字段。
2. 哪些字段不能由模型自由编。
3. 哪些字段必须可 replay。
4. golden case 应该断言什么。
5. 给 Codex 的测试任务。
```

Codex prompt:

```text
按顶级 Codex 工作流执行。

目标：在 /home/ubuntu/workspace/jiqun_ai 冻结 true-loop lifecycle contract。

请先读：
- tests/test_chaotang_study_run_edict.py
- tests/test_chaotang_true_loop_contract.py
- harness/chaotang-true-loop/
- web/routers/chaotang.py

然后实现最小变更：
- 添加或更新 golden case，要求本次 command 必须成为 edict title/summary 主语。
- 历史档案只能作为 evidence，不能抢主标题。
- 保留 human_signoff_required。
- 输出必须有 run_id/case_id/archive/replay path 或明确 missing reason。

验证：
pytest -q tests/test_chaotang_study_run_edict.py tests/test_chaotang_true_loop_contract.py
```

### Stage 4: Repair Backend

Claude Code prompt:

```text
请 code-review 后端 study/run 的修复方案。

重点看：
- 是否忠于用户本次 command。
- 是否把历史材料限制在 evidence。
- 是否没有破坏 live swarm adapter。
- 是否所有 fallback 都有标签。
- 是否需要人类签字。

输出：
1. 必修 bug。
2. 不该改的范围。
3. Codex 执行提示词。
```

Codex prompt:

```text
目标：修复 /api/chaotang/study/run 主语漂移问题。

工作目录：
/home/ubuntu/workspace/jiqun_ai

约束：
- 小步修改。
- 不改无关路由。
- 不把历史 memorial 当成本次主标题。
- dry_run 和 live 都要保留 source_mode。

验证：
pytest -q tests/test_chaotang_study_run_edict.py tests/test_chaotang_true_loop_contract.py
curl --noproxy '*' -sS -X POST http://127.0.0.1:8081/api/chaotang/study/run \
  -H 'Content-Type: application/json' \
  -d '{"command":"请军机处召集户部和工部判断 100MWh 冷库储能项目是否推进。","mode":"dry_run"}'

成功标准：
返回 title/summary 主语必须是 100MWh 项目，旧案只能出现在 evidence。
```

### Stage 5: Verify Frontend

Claude Code prompt:

```text
请从 UX/信任/上线风险角度审查前端真闭环：

页面：
- /study
- /command-center
- /shiguan

重点：
1. 第一屏是否回答“现在该做什么”。
2. LIVE/MIXED/DEMO/FALLBACK 是否清楚。
3. 是否显示 evidence 和 human signoff。
4. 是否有错误态和降级态。
5. 哪些截图必须保留。

输出 Codex 验证提示词。
```

Codex prompt:

```text
目标：验证前端是否正确消费 true-loop contract。

工作目录：
/home/ubuntu/workspace/chaotang-web-lyt

前置：
- 确认后端 8081 在跑。
- 启动前端 3002。

验证：
curl --noproxy '*' -sS http://127.0.0.1:3002/api/health
curl --noproxy '*' -sS http://127.0.0.1:3002/api/court/chaotang/tasks
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/true-loop-contract.spec.ts --project=chromium
pnpm build

如果 Playwright 沙箱失败，用外部权限重跑，不要把它误判为产品失败。
输出：
- pass/fail 表
- 截图路径或失败 context
- 剩余风险
```

### Stage 6: Release Gate

Claude Code prompt:

```text
请做上线前 GO/NO-GO 会审。

输入：
- build 结果
- pytest 结果
- Playwright 结果
- health 结果
- true-loop run 输出
- release scope

请输出：
1. GO / NO-GO。
2. Critical/High/Medium 风险。
3. 必须上线前修的问题。
4. 可以上线后修的问题。
5. Codex 发布前验证提示词。
```

Codex prompt:

```text
目标：执行 release readiness gate，不部署。

前端：
cd /home/ubuntu/workspace/chaotang-web-lyt
pnpm build
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/true-loop-contract.spec.ts --project=chromium

后端：
cd /home/ubuntu/workspace/jiqun_ai
pytest -q tests/test_chaotang_study_run_edict.py tests/test_chaotang_true_loop_contract.py

运行态：
curl --noproxy '*' -sS http://127.0.0.1:3002/api/health
curl --noproxy '*' -sS http://127.0.0.1:8081/api/health

输出：
- GO/NO-GO 表
- 阻断项
- 证据路径
- 上线后第一小时监控项
```

### Stage 7: Archive Learning

Claude Code prompt:

```text
请把本次上线准备过程复盘成 史馆 条目：

必须包含：
- 做了什么
- 哪些判断后来被证据推翻
- 哪些 demo/fallback 风险被发现
- 哪些 prompt 可以复用
- 哪些要变成 skill/harness
```

Codex prompt:

```text
目标：生成 launch retrospective，并沉淀可复用提示词。

输出文件：
- /home/ubuntu/workspace/chaotang-web-lyt/docs/LAUNCH_RETROSPECTIVE_2026-06-08.md
- 如流程重复有效，再建议创建 skill：chaotang-launch-workflow

必须包含：
- commands run
- pass/fail evidence
- defects found
- fixed/not fixed
- next action
```

## Operating Rules For Maximum Leverage

1. Claude Code owns disagreement; Codex owns evidence.
2. Claude Code can suggest architecture; Codex must verify with files/tests.
3. Codex can implement; Claude Code should review risky patches before merge.
4. No launch claim without build, test, health, and browser evidence.
5. No generated business/financial/media claim without source, timestamp, and uncertainty.
6. No legacy code copy without accepted/rejected/deferred ledger.
7. No hidden fallback. Every fallback must be labeled.
8. No irreversible action without human signoff.
9. Every recurring failure becomes a golden case or harness gate.
10. Every useful repeated prompt becomes a skill or playbook after one successful run.

## Folder Answer

Should everything be developed under one folder?

No.

The project should use a multi-repo/workspace discipline:

```text
one product loop
two mainline repos
separate commits
shared contracts and docs
```

Use `/home/ubuntu/workspace/chaotang-web-lyt` for frontend proof and
`/home/ubuntu/workspace/jiqun_ai` for backend proof. Keep `/home/ubuntu` for
global Codex/Claude operating rules. Treat `/home/ubuntu/chaotang-os` as a
read-only library until a specific item is accepted into a migration ledger.

Only use a single temporary folder for experiments if:

1. it is clearly named scratch or archive,
2. it is not treated as source of truth,
3. nothing ships from it directly.

## Default Next Command

When unsure, send this to Codex:

```text
按顶级 Codex 工作流执行。
目标：继续 Chaotang launch workflow 的下一步。
请先读取 CODEX_CLAUDE_LAUNCH_WORKFLOW_PLAYBOOK_2026-06-08.md，
然后根据当前 Git 状态和验证结果选择最小下一步。
不要跨 repo 混改。先说明 repo、端口、验证命令，再执行。
```

When unsure, send this to Claude Code:

```text
请作为 Chaotang 上线会审室，读取当前 launch workflow playbook 和最新验证结果。
不要写代码。请给出最小下一步、最大风险、反方意见，以及可直接发给 Codex 的执行提示词。
```
