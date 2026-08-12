# Harness 清单

## 根级工程 Harness

- `.harness/`：全项目 owner、规则、wiki、manifest、模板与变更记录。
- `scripts/harness-doctor.mjs`：根级健康检查。
- `scripts/new-change.mjs`：根级变更骨架生成器。
- `.harness/manifest/execution-authority.v1.json`：M0–M10 的失效关闭、未激活执行权威清单。
- `.harness/contracts/execution-authority.schema.json`：只允许 `AMENDMENT_REQUIRED / INACTIVE` 的 v1 契约。
- `scripts/execution-authority.mjs` 与 `scripts/lib/execution-authority.mjs`：`V1_CHECK_INTEGRITY_ONLY_NON_AUTHORIZING`；`node scripts/execution-authority.mjs --check` 只验证失效关闭护栏完整性，不构成产品施工决定，v1 `--authorize` 永远 `STOP`。
- `scripts/execution-authority-v2.mjs` 与 `scripts/lib/execution-authority-v2.mjs`：`V2_SCOPED_AUTHORIZE_SOLE_PRODUCT_DECISION`；只有 `node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx>` 的 `GO / APPROVED_WORK_PACKAGE` 才是范围化产品施工决定。
- `.harness/wiki/execution-authority.md`：命令语义、受控摘要重钉流程和 amendment 交接边界。

## 前端工程 Harness

- `frontend/.harness/`：前端 owner、规则、skills、wiki、模板与变更记录。
- `frontend/scripts/harness-doctor.mjs`：前端健康检查。
- `frontend/scripts/new-change.mjs`：前端变更生成器。

## 后端运行/评测 Harness

主要后端 harness 包列在 `.harness/manifest/project-harness.json` 和 `backend/harness/manifest.json`。

后端 harness 层包括 commercial-loop、true-loop、deep-research skill distillation、户部投资研究安全闸门、department protocol、体验契约、merit、legal red-team、open-source watch、resource consolidation、swarm tool matrix 和 yushi global gate 等检查。

原 `frontend/harness/` 下的 `deep-research-skill-distillation` 与
`hubu-investment-swarm-gate` 已归入 `backend/harness/`。它们验证研究证据、
候选技能和蜂群输出安全，不承担浏览器体验验证；浏览器闭环仍由
`frontend/e2e/` 和 `frontend/.harness/` 的工程规则负责。

部分后端目录是实现包或横线命名目录的 Python 命名映射，manifest 会记录这些关系。命名规则见 `backend/harness/_shared/naming-conventions.md`。

- `backend/scripts/harness_doctor.py`：后端 harness 健康检查。
- `backend/harness/_shared/`：后端共享契约、门禁语义、观测字段和命名规范。

## 后端设计与运行时配置（referenceArtifacts）

以下目录不是 harness 运行包，但由 `backend/harness/manifest.json` 的 `referenceArtifacts` 字段追踪，由 `harness_doctor.py` 验证 README.md 存在。

| 目录 | 内容 |
| --- | --- |
| `backend/agent_design/` | 100+ Agent 职责与协作设计文档（buildAgent 下按部门/团队分组） |
| `backend/runtime_prompts/` | 71 个 Agent 角色的运行时 prompt 配置 |

## 验证

当前根级、前端、后端 harness 验证命令见 `.harness/wiki/verification-matrix.md`。

## 能力入口治理

- `.harness/manifest/capability-entry-inventory.json`：跨线功能清算表。
- `.harness/contracts/capability-entry.schema.json`：清算项契约。
- `.harness/contracts/capability-entry-event.schema.json`：统一入口调用遥测契约。
- `.harness/wiki/capability-entry-governance.md`：唯一任务内核、14 天零调用删除门和纵切证据规则。
- `.harness/manifest/knowledge-quality-rubric.v1.json`：K0B 合同/检索/outcome/成本/时效硬门；当前证据状态 `NO_DATA`。
- `.harness/contracts/knowledge-quality-rubric.schema.json` 与 `scripts/knowledge-quality-rubric.mjs`：rubric 契约和确定性 PASS/FAIL/NO_DATA/EXPIRED evaluator。

## EXT 分支能力融合治理

- `.harness/manifest/ext-branch-convergence.v1.json`：冻结 2026-08-03 审计得到的 99 个未合入本地分支及其能力族、唯一 donor、处置和 authority 边界。
- `.harness/contracts/ext-branch-convergence.schema.json`：分支、能力族、处置、状态、checkpoint 和回执字段契约。
- `scripts/ext-branch-convergence.mjs`：只读 `--check`、`--status`、`--family` CLI；不提供 ref、工作树或 manifest 写入口。
- `.harness/wiki/ext-branch-capability-convergence.md`：99/99 清算、失败关闭和后续 Packet 权威边界。

## 专业 Agent 资产矩阵

- `.harness/manifest/professional-agent-asset-matrix.v1.json`：当前 EXT 的专业 Agent 能力、契约、入口、测试与覆盖缺口事实源。
- `.harness/contracts/professional-agent-asset-matrix.v1.schema.json`：Draft 2020-12 字段、成熟度、覆盖状态与安全路径契约。
- `scripts/professional-agent-matrix.mjs`：只读检查器；验证登记路径、exact donor、35 个设计契约和 71 个运行 Prompt。
- `scripts/professional_agent_matrix_schema_check.py`：Draft 2020-12 完整校验；缺少校验依赖时失效关闭。
- `.harness/wiki/professional-agent-asset-matrix.md`：旧 K0 donor 到当前 EXT 的适配边界；`PARTIAL` 不等于可运行或已验收。
