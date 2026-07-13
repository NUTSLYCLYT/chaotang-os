# 规格说明：fix-chaotang-build-office-reviewer-gate-20260714

## 背景

用户要求把新装的开源工具 `ai-job-search`（MadsLorentzen）的 drafter-reviewer 模式（写的人和查的人必须是两个 context，查的人才敢真挑刺）移植进朝堂"建部/建司"工作流。本仓已有对应角色 `gongbu-quality-gate`（御史台复核 agent），但此前从未被 `chaotang-build-office` 的建司流程强制调用，且它的检查清单只覆盖通用质量项（sourceLabel、FALLBACK 冒充 LIVE 等），没有 office-kit 司引擎专属的检查项。

Codex stop-time review 连续八次拦截，逐轮收紧（详见 `request_analysis/tasks.md` 各任务）：从"新检查项误伤兵部定价毛利这一部门专属职能"，到"SKILL.md 源头规范本身与'每部找它独有的一条真回执'矛盾"，到"改动未建变更记录"，到（用户要求深度侦察六部之后）"roster 诚实标注制度本身没有校验机制"，到"检查规则被自己的 nodetest 假通过"，到"生产文件有 import 仍不足以证明真实接线"，到"新增门禁依赖未声明、不可复现的 knip"，最终到本次——"change 记录标 DONE 但 spec/tasks/ci_result 仍是空模板"。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | `chaotang-build-office` 建司步骤从 4 步扩到 5 步，新增强制复核步骤 | `.claude/skills/chaotang-build-office/SKILL.md` 第 11-25 行 | 已验证（人工读取+grep比对） | 否 |
| 已确认事实 | `gongbu-quality-gate` 新增 5 条 office-kit 专项检查（自算钱、阶梯重写、缺nodetest、约省未标估、roster诚实性） | `.claude/agents/gongbu-quality-gate.md` 第 23-32 行 | 已验证 | 否 |
| 已确认事实 | knip 从"配了没人接"的孤儿配置变成 pinned devDependency + 脚本 | `frontend/package.json` devDependencies 新增 `knip: 5.88.1`，scripts 新增 `"knip": "knip"` | `pnpm exec tsc --noEmit` 0 错误 | 否 |
| 已确认事实 | 吏部 `libu-roster.ts` 声明的 5 个司引擎（选才/薪酬/铨叙/组织编制+培训）中 4 个标 `engine:true`，全部只被自身 `.nodetest.ts` 或 roster 字符串提及，无生产代码真实 import | `pnpm knip --files` 稳定复现（349 行，含 `libu-roster.ts`/`hubu-roster.ts`）；`grep -rln` 逐一核实 | 已验证（5 次连续跑knip结果一致） | 否 |
| 已确认事实 | knip 在依赖变动后首次运行有一次性漏报（128 行，遗漏 `libu-roster.ts`），原地重跑立即稳定在 349 行 | 本会话实测，已写入 `gongbu-quality-gate.md` 门禁指令的警示段落 | 已验证（连续5次复现） | 否，但已作为门禁使用须知记录 |
| 推测 | "毛利"最初被误列为违铁律6 是因为跟 ROI/年成本表面相似，没有先读 SKILL.md"每部找它独有的一条真回执"那段就下判断 | 本人第一版编辑记录（已被后续版本覆盖） | 无需继续验证，已修正 | 否 |
| 未知问题 | 六部命名体系（office-kit拼音/军机处英文/bureau英文/backend中文/backend拼音/ministry-registry英文/dept.ts SSOT）共 7 套并存，含"libu"在前后端语义相反的真实命名冲突 | 见另一轮深度侦察的对话记录（未落地为本变更的一部分） | 待用户拍板范围 | 是——但明确不在本变更范围内，见"非目标" |

## 数据流与调用链

本变更不涉及运行时数据流——`.claude/skills/`、`.claude/agents/` 是 Claude Code 读取的工作流配置文件，不参与前端渲染或后端请求路径；`frontend/package.json`/`pnpm-lock.yaml` 的改动仅新增一个开发期工具依赖（knip），不进入生产构建产物（`knip` 不在 `dependencies`，只在 `devDependencies`）。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `<部>-roster.ts` 的 `engine`/`reuses` 字段 | 各部门 roster 文件作者（Claude Code agent） | `gongbu-quality-gate` 复核时读取 | 本变更新增校验：字段声明必须能被 knip 可达性分析 + 生产代码 import 佐证，不能只是文档字符串 |
| `frontend/knip.json` | 早前某次改动引入（本变更之前未接依赖） | `pnpm knip` 脚本 | 本变更之前配置文件与 `package.json` 不一致（配置存在但工具未声明），已修复对齐 |

## 范围

- `.claude/skills/chaotang-build-office/SKILL.md`：建司步骤 4→5 步，铁律6 表述收窄。
- `.claude/agents/gongbu-quality-gate.md`：新增 office-kit 专项检查清单（含 roster 诚实性 + knip 可达性分析用法 + 已知首次运行漏报的使用须知）。
- `frontend/package.json` / `frontend/pnpm-lock.yaml`：knip 从孤儿配置转为声明依赖。
- 本目录下完整变更记录（summary / spec / tasks / ci_result）。

## 非目标

- 不实现六部命名体系统一（`ministry-bridge.ts`）——已设计（`ministry-types.ts:4-8`，2026-06-17）但未建，属于跨前后端命名变更，需要用户单独拍板范围，不在本次改动内。
- 不修复 backend `chaotang_department_router.py` 里 `"libu"` 键语义与前端相反的命名冲突——同样是需要用户单独确认范围的改动。
- 不迁移 `hubu-roster.ts`/`gongbu-roster.ts`（岗位目录模式）到 office-kit 的司花名册模式——两者内容模型不同，服务场景不同，未发现足够收益支撑重写已跑通的生产路径。
- 不新建任何新 agent 或新框架——全程复用已有的 `gongbu-quality-gate`。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 部门专属算账逻辑（如兵部定价毛利） | 不触发"自算钱违铁律6"blocker | SKILL.md 与 quality-gate.md 均显式排除，见第 25 行/第 15 行措辞 |
| 引擎只被自己的 `.nodetest.ts` 引用，无生产 import | 判定为孤儿，blocker 触发 | 吏部 5 个引擎实测验证 |
| `pnpm install` 或依赖变动后第一次跑 `pnpm knip` | 可能漏报，不可直接采信第一次结果 | 已实测复现并写入门禁指令 |

## 风险与回滚边界

- 风险：`gongbu-quality-gate` 新增检查项让未来的建司复核变得更严格，可能拖慢开发节奏——可接受，因为目标就是堵住"标了但没人用"的自证不自审漏洞。
- 风险：knip 5.x 与已有 `knip.json`（schema 指向 v5）兼容，未验证 v6——本次刻意锁 5.88.1，不引入未验证的大版本升级。
- 回滚边界：`git checkout` 还原 4 个改动文件即可完全撤销，无数据库迁移、无运行时状态、无需额外清理步骤。

## 计划确认记录

- 批准人：（用户在对话中口头确认"是的"，同意基于 ai-job-search 模式给 chaotang-build-office 加复核 agent）
- 批准日期：2026-07-14
- 批准范围：仅 `chaotang-build-office` + `gongbu-quality-gate` 复核门禁；深度侦察发现的六部命名冲突/系统融合问题已明确列为独立未决事项，等待用户单独批准范围。
- 明确未批准：`ministry-bridge.ts` 建设、`"libu"` 命名改名、hubu/gongbu roster 迁移。

## 验收标准

- `node scripts/harness-doctor.mjs` 0 errors（每轮改动后复跑）。
- `cd frontend && pnpm exec tsc --noEmit` 0 错误。
- `.claude/skills/chaotang-build-office/SKILL.md`、`.claude/agents/gongbu-quality-gate.md`、`frontend/package.json` 三处对"铁律6/自算钱/部门专属逻辑"的措辞互不矛盾（`grep -n "算钱\|专属\|真回执"` 双文件比对）。
- roster 诚实性检查规则对吏部已知孤儿引擎（`hiring-review`/`training-review`/`org-headcount-review`/`promotion-review`/`compensation-band`）实测能正确识别。
- 本目录四个变更记录文件（summary/spec/tasks/ci_result）均填写完整，不留 `{{...}}` 模板占位符或"待填写"字样。

## 验证计划

- `node scripts/harness-doctor.mjs`
- `cd frontend && pnpm exec tsc --noEmit`
- `cd frontend && pnpm knip --files`（连续跑 2 次以上确认稳定，避免依赖变动后首次运行的漏报）
- `grep -rln "<engine-name>" --include="*.ts" --include="*.tsx" frontend/src | grep -v "\.nodetest\.ts$"` 对吏部 5 个孤儿引擎逐一核实
