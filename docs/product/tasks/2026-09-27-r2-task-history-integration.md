# R2：军机处真实任务列表与个人历史整理

## Status

Prepared for exact Owner review。未批准该精确摘要，未创建批准提交，未获得产品 GO，未修改产品源码。

清单摘要：`sha256:1d055f9a2f8af945211432b7564b055f0652a3056f23c6afbed54dcc2be00be2`。
`R2-HISTORY.proposed-approval.json` 中 APPROVED_FOR_ONE_CHILD 是待批准机器清单要求的字段值，不是已批准事实。真实状态以本文件和 R2-HISTORY.review.json 为准。

## Product Definition

- 用户目标：登录后能看到自己的真实任务，搜索、翻页，将已终止任务移入历史并恢复；重启后保留标记。
- 根因：当前 CDesktop 已调用这些接口，但 ext-dev f410883 的后端缺少对应路由。旧便携版有实现，其数据库结构与当前严格证据保护不兼容，不能整文件覆盖。
- 上游授权：用户已授权继续整合并批准先前三个候选推送；这不重复申请 R1 或原基线推送。本批是新的具体施工清单。
- 用户可验收结果：两个账户互不看到对方任务；终止任务可整理；办理中的任务不能被隐藏成“已完成”。
- 本批不宣称：真实 Agent 办理、案卷事件、重试、史馆成果归档、客户试用或发布完成。

## Base and Scope

- 仓库：G:/ChaotangSource/chaotang-os-ext-dev-20260925，ext-dev。
- baseCommit：f41088319aaae65210c60fba6c67e2bcea5e90f9。
- baseTree：35b38aa08e3e09d93860f6bd4cfec5a93a14a9eb。
- 批准提交仅包含 `.harness/approvals/CT-R2-TASK-HISTORY-INTEGRATION-20260927.json` 与 `docs/product/tasks/2026-09-27-r2-task-history-integration.md`。
- 后续施工仅限五个产品路径：
  - backend/app/api/decree_jobs.py
  - backend/app/decree_jobs/storage.py
  - backend/tests/test_decree_history_http_integration.py
  - backend/tests/test_decree_job_storage.py
  - backend/tests/test_decree_jobs_api.py
- 不修改 ADR 0028、authority、权限或新的任务系统；不访问真实用户运行库，不操作原生窗口，不调用模型。

## API Contract

沿用 CDesktop 已有 snake_case → camelCase 适配，不另建接口体系：

1. `GET /api/v1/decree-jobs`：limit 默认 50、1–100；offset 非负且有上限；q 最多 500 字符，SQL 通配符作为普通搜索字符；archived 为 active/archived/all，默认 active。
2. 响应 `{items,total,limit,offset}`。每项复用原有安全任务响应，并带真实 `history_archived` 布尔值；不能返回占位 false 冒充持久化能力。可从已存旨意确定标题，但不合成执行意见。
3. `GET /api/v1/decree-jobs/{job_id}/history-annotation`：仅查询自己的任务，未标记返回 false、updated_at=null。
4. `PUT /api/v1/decree-jobs/{job_id}/history-annotation`：只接受严格布尔 archived，拒绝多余字段、owner 注入和字符串布尔。仅 SUCCEEDED/FAILED/CANCELLED 可修改。重复相同请求不虚增时间。
5. 匿名 401；别人的 ID 和不存在 ID 均 404；未终止任务 409，稳定码 job_history_archive_rejected；存储故障只给稳定安全错误，不能泄露 SQLite 路径或原异常。
6. 列表计数、分页和历史标记来自同一读取事务快照，按 created_at DESC、job_id DESC 稳定排序。

## Storage and Compatibility

- 历史整理是 owner 私有展示属性，不是史馆归档、删除、验收通过或任务状态变化。
- 在现有任务数据库添加小型注释表，仍由同一个 DecreeJobStore 管理，不建第二任务账本。
- 保留当前所有冻结旧结构身份和迁移的精确识别。只对已知结构执行事务升级；陌生表、索引、触发器、变形字段继续拒绝，不放宽为任意结构。
- 升级保留任务全部字段、idempotency 映射、claim_evidence_commitment_json、owner 和业务结果。已升级库重开不写入。
- 未知库及 WAL/SHM/journal 拒绝前后字节保持；并发结构变化在锁内再次核查。
- 不把原便携 storage.py 的 external attempt/retry 实现一起迁入。案卷与重试下一批单独绑定预算、取消和真实事件。
- 当前完整性校验绑定 storage.py 内容。产品改动若使六部就绪指纹失效，必须如实记录，准备独立审查与治理后继；本批不允许自动重算可信证据或跳过校验，未解决前不宣布可发布。

## Acceptance Criteria

- [ ] 在原 CDesktop 已有历史入口契约下获得真实分页任务数据；A/B 双账户严格隔离。
- [ ] 搜索中文、百分号、下划线、反斜线、空查询和边界分页行为正确。
- [ ] 所有终止状态可整理和恢复；非终止状态拒绝；重复操作幂等。
- [ ] 标记经过真实临时 SQLite 重启仍保存；整理不改变任务结果、证据或史馆记录。
- [ ] 冻结旧结构升级后数据完整；未知结构、额外 trigger/index、WAL 侧文件保持保护；回滚不靠删库。
- [ ] 现有预算、取消、证据承诺和 worker 测试无回归。
- [ ] 使用真实临时 Uvicorn + 真实注册/登录 + HTTP 请求验证列表与注释，并关闭后台进程。测试任务由明确标注的 fixture 创建，不冒充真实 Agent 产出。
- [ ] 报告命令、开始/结束时间、退出码、通过/失败原因、模型=false、外网=false、loopback HTTP=true、原生后端=true、原生 UI=false。
- [ ] 原生 CDesktop UI 验收留待允许操作窗口或取得已有可用隔离浏览器途径；API 验收不能替代它。

## Technical Plan and Quality Gates

任务类型：API + 数据升级，五个精确文件，已有前端消费者，升级风险高于普通 UI 改动。
路由：Superpowers 等价 Codex 顺序步骤；使用现有 codex-engineering-workflow 和 LYT1，不安装第三方工具。Codex-only。

1. 精确摘要批准后，落地两份批准材料的独立提交并推送；原 M0 authorize 返回 GO 后施工。
2. 先写缺失路由、owner 隔离、持久化与升级失败的 RED 用例，再做最小实现。
3. 通过清单中四组验证：改动 Python lint、任务与鉴权回归、diff 检查、真实 HTTP 历史流程。
4. 审查事务一致性、动态路径路由优先级、StrictBool、SQL 搜索转义、安全错误和内容锁影响；失败则修复。
5. 用批准提交的精确单亲子生成候选，经 M0 verify；最终 SHA/tree 另呈 Owner，不提前推送产品候选或部署。

遇到迁移需额外文件、ADR 变更或冻结证据更新时，停止扩大产品范围，先给出差异与最小后继方案。

## Rollback

实施前保存 f410883 源码身份和临时验证库备份。实际运行库首次升级前另备份并验证可恢复，不能直接使用本批 fixture 证明客户库已可恢复。数据库升级后回退旧代码须同步恢复升级前对应数据库；不能只切代码后继续访问新表结构。禁止删表凑兼容、覆盖用户数据或强推共享分支。

## Implementation Report / Acceptance Review

目前仅完成源码对照、前端契约核对、精确路径和验证矩阵准备、现有验证器的清单 schema 校验。产品实施、RED/GREEN、新接口 HTTP 验收、迁移和最终候选均未执行；G3 仍未通过。
