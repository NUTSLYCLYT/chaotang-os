# Harness 清单

## 根级工程 Harness

- `.harness/`：全项目 owner、规则、wiki、manifest、模板与变更记录。
- `scripts/harness-doctor.mjs`：根级健康检查。
- `scripts/new-change.mjs`：根级变更骨架生成器。

## 前端工程 Harness

- `frontend/.harness/`：前端 owner、规则、skills、wiki、模板与变更记录。
- `frontend/scripts/harness-doctor.mjs`：前端健康检查。
- `frontend/scripts/new-change.mjs`：前端变更生成器。

## 后端运行/评测 Harness

主要后端 harness 包列在 `.harness/manifest/project-harness.json` 和 `backend/harness/manifest.json`。

后端 harness 层包括 commercial-loop、true-loop、department protocol、体验契约、merit、legal red-team、open-source watch、resource consolidation、swarm tool matrix 和 yushi global gate 等检查。

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
