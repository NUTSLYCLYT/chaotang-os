# 任务：feat-scene-pack-v1-amendment-20260903

## 任务 1：治理 amendment 编制

- 目标：记录 Scene Pack V1 的用户授权范围、B2B 真实链路扩展、企业增长真实链路扩展、系统边界、数据契约、验收和非目标。
- 前置条件：用户在 2026-09-03 chat 明确批准创建并执行 amendment，且不授权 push、merge、deploy。
- 输入：用户 Scene Pack V1 任务书、B2B 询盘成交 Pack V1 追加任务书、企业经营增长诊断 Pack V1 附件任务书、项目 AGENTS/Harness/authority 规则、当前 git/authority 事实。
- 输出：`amendment.md`、`summary.md`、`request_analysis/spec.md`、`request_analysis/tasks.md`、`ci_result/ci_summary.md`。
- 涉及文件：仅 `.harness/changes/feat-scene-pack-v1-amendment-20260903/`。
- 状态 / 数据变化：只新增治理文档，不修改 frontend/backend 产品 runtime。
- 验证命令与证据：`node scripts/execution-authority.mjs --authorize`、`node scripts/harness-doctor.mjs`、`sha256sum .harness/changes/feat-scene-pack-v1-amendment-20260903/amendment.md`。
- 回滚边界：删除该 change 目录即可回滚治理草案；不影响产品代码。
- 完成定义：change 记录完整，明确 `SCOPE_EXPANDED_ENTERPRISE_GROWTH_PENDING_EXACT_APPROVAL / MACHINE_AUTHORITY_STOP`，并给出下一步 exact approval 口径。

## 任务 2：authority 绑定候选

- 目标：后续将 Scene Pack V1 amendment 绑定到机器可读执行权威，使 `--authorize` 不再对该 scoped package 返回 STOP。
- 前置条件：Product Owner 对包含 B2B 与企业增长真实链路的新 exact amendment digest、exact base、批准范围和独立复审结果再次确认。
- 输入：任务 1 的 amendment digest、后续指定 `ext-dev` exact HEAD、独立 review。
- 输出：候选 authority v2/schema/manifest/consumer 或项目认可的等价 gate 绑定。
- 涉及文件：待后续治理授权确认，不在本任务直接修改。
- 状态 / 数据变化：治理层变更，不得夹带产品 runtime。
- 验证命令与证据：authority unit tests、root doctor、diff review。
- 回滚边界：单一治理 commit 回滚。
- 完成定义：`node scripts/execution-authority.mjs --authorize` 对 Scene Pack V1 scoped package 可返回可执行结论，或项目另有明确等价放行命令。

## 任务 3：产品实现候选包

- 目标：在 authority 放行后，实现 Scene Pack V1 最小闭环，包含单品出海、B2B 询盘成交、合同与回款风控、企业经营增长诊断四个真实场景。
- 前置条件：任务 2 完成；checkout 绑定到获批 `ext-dev` exact HEAD；产品实现权限明确。
- 输入：Scene Pack V1 amendment、现有丞相/flow/军机处/证据/史馆主链。
- 输出：后端模型/API、前端大殿入口、共用场景页、军机处看板、demo 数据、Playwright 验收。
- 涉及文件：候选详见 `summary.md` 和 `spec.md`。
- 状态 / 数据变化：新增/迁移 Scene Pack 运行记录与军机处投影；不得新增第二事实源。
- 验证命令与证据：后端 API 测试、前端类型/build、Playwright、harness doctor。
- 回滚边界：单一产品 commit + migration downgrade。
- 完成定义：四个真实场景完成入口到看板详情闭环，一个 stub 场景结构一致且不混淆 demo/LIVE。
