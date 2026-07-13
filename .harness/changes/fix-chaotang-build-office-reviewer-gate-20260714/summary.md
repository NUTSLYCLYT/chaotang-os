# 变更摘要：fix-chaotang-build-office-reviewer-gate-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | fix-chaotang-build-office-reviewer-gate-20260714 |
| 类型 | fix |
| 状态 | DONE |
| Owner | Project Agent |
| 创建日期 | 20260714 |

## 范围

- 主线：根项目（`.claude/` 项目级 Claude 工作流配置——建部/建司 skill 与御史台 agent，不属于 frontend/backend 任一工程线）
- 文件：
  - `.claude/skills/chaotang-build-office/SKILL.md`（建司步骤 4 步→5 步，新增"复核（必过）"步骤；铁律6 表述从"钱只户部算"改为限定"户部通用算钱原语（`annualLaborCost`/`computeRoi`）"，明确部门专属算账逻辑（如兵部定价毛利）不受限）
  - `.claude/agents/gongbu-quality-gate.md`（新增 office-kit 司引擎专项检查项：重复实现户部两个算钱函数、阶梯逻辑被重写、缺 nodetest、"每年约省"未标估、`sourceNote` 标 LIVE 但查无实据、`<部>-roster.ts` 声明的 `reuses`/`engine:true` 排除自身 nodetest 后查无生产代码真实 import，改用 `pnpm knip --files` 做权威可达性分析；同步收窄为不含部门专属算账逻辑）
  - `frontend/package.json`（新增 pinned devDependency `knip@5.88.1` + `"knip": "knip"` 脚本，此前仓库只有 `frontend/knip.json` 配置、没有声明依赖，等于配置本身也是"接了配但没装工具"的孤儿）
  - `frontend/pnpm-lock.yaml`（`pnpm install` 自动更新，锁定 knip 及其传递依赖版本）
- 验证：人工比对三处（建司步骤、铁律6 定义、复核 agent 检查清单）用词一致，`grep -n "算钱\|专属\|真回执" .claude/skills/chaotang-build-office/SKILL.md .claude/agents/gongbu-quality-gate.md` 确认无遗留矛盾表述；roster 造假检查项对吏部 `hiring-review`/`training-review`/`org-headcount-review`/`promotion-review`/`compensation-band` 五个引擎实测：排除各自 `.nodetest.ts` 后，全仓仅 `libu-roster.ts` 一处提及，确认规则能正确识别"只被自己测试引用、生产未接线"的孤儿；`cd frontend && pnpm exec tsc --noEmit` 加依赖后仍 0 错误；`pnpm knip --files` 连续跑 5 次确认稳定复现（第 1 次刚装完依赖时曾出现漏报，见背景第 7 条）

## 背景

参照 `ai-job-search`（MadsLorentzen）的 drafter-reviewer 模式移植到朝堂建部/建司工作流：写引擎的 agent 不能自审，需独立 context 的复核agent 挑刺（对应本仓已有的 `gongbu-quality-gate` 御史台角色，此前未被建司流程强制调用）。

Codex stop-time review 三次拦截，逐次收窄：
1. 首次改动在 `gongbu-quality-gate.md` 新增检查项时把"毛利"与"ROI/年成本"并列列为违铁律6，误拦兵部定价毛利这一该部门专属职能。
2. 收窄 `gongbu-quality-gate.md` 措辞后，`chaotang-build-office/SKILL.md` 里"写引擎"步骤与铁律6 定义本身仍是无限定的"禁自算钱"/"钱只户部算"，与文档自身"每部找它独有的一条真回执"（兵部=定价毛利）矛盾，同一漏洞会在源头规范里重新出现。
3. 前两次修复内容改动完成、但未按 `AGENTS.md` 第5条在 `.harness/changes/` 建根级变更记录——本记录补齐该步骤。

4. 用户要求对六部整体做深度侦察（丞相调度链路健康度 + 六部各司引擎设计质量），侦察中实测发现吏部 `libu-roster.ts` 声明的 `engine:true`/`reuses` 字段（选才司/薪酬司/铨叙司/组织编制司）全仓查无一处真实 import——roster 诚实标注制度本身没有校验机制，等于自证不自审。补充本条检查项，让 `gongbu-quality-gate` 未来能照出这类"标了但没接"的空转声明，而不仅仅检查 `sourceLabel`/`sourceNote` 这类运行时标注。

5. Codex stop-time review 第四次拦截：第4步新增的 roster 检查项只写"找不到任何 `.ts`/`.tsx` import"，但每个引擎自己的 `<司>-review.nodetest.ts` 本来就 import 自己做测试，这条检查会把"只被自测试引用、生产从未接线"的引擎误判为已接线（假阴性，门禁形同虚设）。修正为显式排除引擎自身的 `.nodetest.ts`，只认生产代码（`.tsx` 组件或非 nodetest 的 `.ts` 文件）的 import 为真实接线证据；对吏部五个孤儿引擎重新实测确认修正后规则能正确识别。

6. Codex stop-time review 第五次拦截："生产文件有 import"依然不足以证明真实接线（可能只是 import 类型、re-export 无人消费，或 importing 文件本身也是死代码，两三层之后才断链）。改用仓库已有的 `frontend/knip.json`（entry 已含 middleware/next.config/nodetest/e2e/scripts）做权威可达性分析：`npx knip@5 --include files` 实测确认 `libu-roster.ts` 本身就在 unused files 列表里——roster 文件自己都没被任何生产代码 import，不用逐个再查旗下引擎。同时明确记录 knip 自身的盲区：它的 entry 包含 `**/*.nodetest.ts`，会把"只被自己测试引用"的文件判定为 used，因此 roster 在用时仍需人工确认 import 链最终能摸到 `src/app/` 下的 page/route，而非仅停留在 knip 的"used"结论。

7. Codex stop-time review 第六次拦截：门禁指令里让 agent 跑 `npx knip@5`，但 knip 从未作为本仓声明依赖——版本不锁、不可复现，`frontend/knip.json` 配置本身也成了"配了没人接"的孤儿（和本变更要抓的 roster 造假是同一类问题）。修复：把 knip 正式加入 `frontend/package.json` devDependencies（锁定 `5.88.1`，匹配 `knip.json` 里 `$schema` 指向的 v5，未跟进未验证过的 v6），加 `"knip": "knip"` 脚本，`pnpm install` 更新 lockfile，门禁指令改引用 `pnpm knip --files`。过程中意外实测到：`pnpm install` 后第一次跑 `pnpm knip --files` 输出行数偏少（128 行），漏报了 `libu-roster.ts`；同一条命令原地重跑立刻稳定在 349 行且含 `libu-roster.ts`/`hubu-roster.ts`，连续 5 次复现一致。已把"依赖变动后第一次跑 knip 可能漏报，需重跑一次以稳定结果为准"写入门禁指令，防止未来审查者被首次运行的假阴性误导。`pnpm exec tsc --noEmit` 确认加依赖未破坏任何类型检查。
