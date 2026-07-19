# CI 摘要：docs-product-r0-freeze-20260718

## 验证上下文

| 字段 | 值 |
| --- | --- |
| 日期 | 2026-07-18；PR 追补验证 2026-07-19 |
| 干净基线 | `feature-chaotang-ext@5d273c3fbe5e02e52b6ab3e8630f6d54a0c78a43` |
| source-preservation commit | `33dac7b47be09c60f77642b74a4be1afe0e0c673` |
| 被隔离的本地主线 | `79b1eaa530ef60e776dfcbf79c5f52cf4f611830` |
| 工作树 | `product-r0-freeze-20260718` |
| 变更类型 | 文档与产品契约；无运行时代码 |
| 2026-07-19 目标快照 | `feature-chaotang-ext@05582e520300e32a5d84e2b38b3822903f75c954`（移动即重验） |
| PR !3 修复前 head | `3c05aae1c9abef51d114a6e7c3e71a685833bd87` |

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `git diff --check` | 0 | PASS | 空白、冲突标记与 patch 结构 | 本地候选，2026-07-18 |
| Node 只读 Markdown checker | 0 | PASS：最终差异中的 27 个 Markdown 文档围栏成对、相对链接存在 | Markdown 结构与本地链接 | 本地候选，2026-07-18 |
| Node 六部 41 司计数 | 0 | PASS：`7+6+7+7+7+7=41` | `TARGET_DIRECTORY_V1` 数量契约 | `PROJECT_PRODUCT.md`，2026-07-18 |
| Node REQ/目标/假设/开放问题 ID 去重 | 0 | PASS：56 个定义行、56 个唯一 ID | R0/R1 PRD 可追踪性 | R0/R1 PRD，2026-07-18 |
| Node 路径 allowlist | 0 | PASS：相对基线 27 个路径全部允许 | 无 frontend/backend/scripts/规则越界 | 本地候选，2026-07-18 |
| `sha256sum source_inputs/*.md` | 0 | PASS：A=`51374f5d…d5a5b3`；B=`715a8126…d0813` | 不可变审计输入 | `source_inputs/`，2026-07-18 |
| `sha256sum chaotang-os-product-definition-convergence-blueprint-2026-07-18.md` | 0 | PASS：旧 `475f13ad…de2` → 冻结稿 `591f7673…ccfe` | Decision Record 精确内容 | `docs/plans/`，2026-07-18 |
| `node scripts/harness-doctor.mjs` | 0 | PASS：0 errors，0 warnings | 根/前端/后端护栏结构与边界 | 本地候选，2026-07-18 |
| `git merge-base / rev-list / rev-list --merges` 组合核验 | 0 | PASS：4 个产品提交线性源自 `5d273c3`；与 `79b1eaa` merge-base 仍为 `bf7d4cc`；无 merge commit | 不引入本地大分叉提交 | 本地候选，2026-07-18 |
| `git ls-remote origin` | 0 | PASS：审查期发现目标由 `6ee6d8d` 前进至 `5d273c3`；安全分支仍为 `79b1eaa`；产品分支未预先存在 | 远端漂移、隔离与回滚锚点 | origin，2026-07-18 |
| `git merge-tree --write-tree` + `git rebase origin/feature-chaotang-ext` | 0 | PASS：目标新增 3 个 P8/P9 前端收口提交与产品文档零冲突；候选已线性重基至 `5d273c3` | 合并可行性与最新目标基线 | 本地候选，2026-07-18 |
| 独立产品冻结内容预审 | 不适用 | ALLOW（初审两个阻塞已修复并复核） | 权威唯一性、发布顺序、41 司、合同范围、世界杯、失败语义 | `product_freeze_precheck`，2026-07-18 |
| 精确 HEAD stop-gate 首轮 | 不适用 | BLOCK：`b1ae7c0` 发现旧 launch blueprint 仍自称当前 FULL_COURT/最终产品权威；当前修订已补 historical/superseded 横幅，待最终精确复审 | 旧权威残留与祖先/快照 | `exact_head_stopgate`，2026-07-18 |
| stale-authority 修复复核 | 不适用 | ALLOW：launch/full-court/backlog/department 与 plans 目录规则已完整关闭原 blocker | 当前未提交修订内容 | `exact_head_stopgate` follow-up，2026-07-18 |
| 第二轮精确 HEAD stop-gate | 不适用 | BLOCK：`3bcaf95` 发现 single-fact-source/knowledge-flywheel 仍声明旧 Step 0–12 上位权威，且回滚未覆盖最终修复提交；当前修订改为 reference-only 与 commit-range 回滚 | 下游旧权威链与可执行回滚 | `final_exact_stopgate`，2026-07-18 |
| 下游权威与回滚修复复核 | 不适用 | ALLOW：两份下游计划已降为 reference-only；旧基线候选的自覆盖回滚设计成立；重基后等价区间已改为 `33dac7b..HEAD` / `5d273c3..HEAD` | 旧基线内容复核；重基后仍须精确 HEAD 复审 | `final_exact_stopgate` follow-up，2026-07-18 |
| Gitee PR !3 服务端预合并 | 0 | PASS：`refs/pull/3/MERGE@0ebe7812...` 双亲精确为 `05582e5... + 3c05aae...`；PR/target 文件交集 0 | 修复前 PR 的内容级可合并性；不证明平台审批/检查 | Gitee refs + 临时 worktree，2026-07-19 |
| 修复前 PR 精确 HEAD stop-gate | 不适用 | BLOCK：产品冻结 DoD 混入未实现跨端条件；department P0–P9/旧裁决与 single-fact C0–C2 仍带当前执行权 | 产品状态与旧执行权威 | `pr3_exact_head_stopgate`，`3c05aae...`，2026-07-19 |
| 正文窄修内容 follow-up | 不适用 | ALLOW：三项 blocker 全部关闭，未引入新 SSOT、状态或执行权威矛盾 | 3 份被阻断正文 + 当时 2 份 change 分析记录 | `pr3_exact_head_stopgate` follow-up，2026-07-19 |
| `b2627be...`：27 文件 scope/Markdown/link + `git diff --check` | 0 | PASS：完整 PR 仍只有 27 个 Markdown 路径；本次提交为 3 份正文 + 4 份 change 证据 | 提交后精确树、结构、相对链接、冲突标记 | exact commit `b2627be...`，2026-07-19 |
| `sha256sum source_inputs/{A,B}.md` | 0 | PASS：A=`51374f5d…d5a5b3`；B=`715a8126…d0813` | 不可变输入未被追补污染 | exact commit `b2627be...`，2026-07-19 |
| `node scripts/harness-doctor.mjs` | 0 | PASS：0 errors，0 warnings | `b2627be...` 单分支与合入 `05582e5...` 的临时 worktree | exact commit + merge preview，2026-07-19 |
| `b2627be...` exact stop-gate | 不适用 | BLOCK：原产品 blocker 均关闭；唯一问题是 CI/spec 仍把已提交 7 路径写成“5 文件未提交候选” | 审计时态，不是产品内容 | `pr3_exact_head_stopgate`，2026-07-19 |
| 本证据提交 | 不适用 | 只纠正 `b2627be...` 的文件数、提交状态与 exact-review 记录；不改变产品字段或旧路线处置 | 证据自洽；最终 head 裁决留在分支外 | 2026-07-19 |

## 结果

产品冻结文档验证通过：

- 产品 SSOT 唯一定义“可信复杂任务超级助手”。
- 第一 Offer 唯一冻结为合同决策 Paid Design Pilot。
- 41 司是 `TARGET_DIRECTORY_V1`，目录与生产成熟度分离。
- 世界杯是只读跨域 benchmark，不是 R1 Offer。
- 发布顺序在 SSOT、PRD、guide、Decision Record 中统一为 `R0 → R1 → R2 → R3+`。
- PDF/DOCX/JSON 是 R0 基础必需成果；track-changes/附加格式仍是开放问题。
- direct ACK、worker 回执和部分结果不得派生 `DELIVERED`。
- 旧 FULL_COURT 全量 L3 与旧 Step 0–12 仅保留历史审计，不再拥有当前范围或排期。
- 旧 launch/full-court/backlog/department/single-fact-source/knowledge-flywheel 计划已显式降为 historical/reference，`plans/` 目录本身不再暗示“已批准”。

## 未验证项

- 未验证任何前后端业务行为、模型质量、浏览器体验、生产数据或部署；本 change 没有修改这些内容。
- 三项已知信誉漏洞仍阻塞 R0/R1，必须由后续 TDD 工程 change 修复。
- M0–M10 amendment、法律/数据 Owner、合同 taxonomy、文件阈值、人工复核与 provider 边界仍待下一阶段。
- PR !3 已创建但尚未正式合入；Gitee 页面会话未登录（403），平台 checks/review/branch policy 尚未由本地证据证明。
- 最终 PR head 的 SHA 级裁决与 Gitee 服务端预合并必须在分支外刷新；裁决结果不写回本分支，避免证据提交改变被审 SHA。
- 未发布生产，未接收真实合同。

## Diff 与回滚复核

- changed files：相对 `5d273c3` 共 27 个允许路径；前置 commit 含 14 个产品定型输入/审计路径，本次另涉及 13 个冻结/历史权威路径，并继续修订其中 3 个前置权威/索引文档。
- diff review：2026-07-18 两轮旧权威 blocker 已关闭；2026-07-19 对 PR head `3c05aae...` 又发现 3 项残留，正文修复 follow-up 已 ALLOW；`b2627be...` exact review 只发现审计时态过期，本证据提交予以关闭。最终 head 仍走分支外 SHA 交付门。
- 回滚是否演练：旧基线最终候选已在临时 detached worktree 验证两种 revert 树精确匹配；重基后候选在推送前重跑。等价命令为 `git revert --no-commit 33dac7b47be09c60f77642b74a4be1afe0e0c673..HEAD`（保留输入包）或 `git revert --no-commit 5d273c3fbe5e02e52b6ab3e8630f6d54a0c78a43..HEAD`（整包）。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 唯一产品身份、Offer 与权威层 | SSOT、PRD、RFC/guide 状态与链接 | PASS |
| R0/R1 可追踪产品契约 | 22 条 R0 REQ、5 条 R1 REQ、1 条 R2 REQ；状态/失败/验收/回滚 | PASS |
| 41 司精确且不冒充上线 | 自动计数 41；成熟度与 `NO_DATA` 分离 | PASS |
| 旧发布与执行权威已替代 | guide 顶部/`9/`11/`12；RFC `11.3；六份历史计划的 supersession 横幅 | PASS |
| 历史输入不可变 | A/B SHA-256 精确匹配 | PASS |
| 无范围外代码与历史污染 | 27 路径 allowlist、ancestry 与无 merge commit | PASS |
| 根级护栏健康 | harness doctor 0/0 | PASS |
| 独立内容 stop-gate | 三项产品 blocker 修复 follow-up `ALLOW`；最终 head 由分支外 exact review 裁决 | `CONTENT_PASS / EXTERNAL_SHA_GATE_REQUIRED` |

## 声明状态

- `VERIFIED_COMPLETE`：仅声明产品冻结文档与三项权威修复内容已验证；最终精确 SHA stop-gate 是分支外的推送/合入门，不由被审分支自我证明。
- 不声明 PRD 已实现、R0/R1 已通过、R2 已上线或 41 司已生产可用。
