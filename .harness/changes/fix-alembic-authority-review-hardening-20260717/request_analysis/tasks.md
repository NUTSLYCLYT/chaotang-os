# 任务：fix-alembic-authority-review-hardening-20260717

## 任务 1：冻结上游残余缺口

- 目标：用临时 SQLite 证明 missing-file、candidate fingerprint、已发布 014 后缺少复验、service strict 缺口。
- 前置条件：B=`346dc81`，独立 worktree clean。
- 输入：上游 authority/adoption/014/service 实现。
- 输出：专用 RED tests。
- 涉及文件：对应 `backend/tests/test_*`。
- 状态 / 数据变化：只写测试；临时目录。
- 验证命令与证据：定向 pytest 必须按契约失败。
- 回滚边界：删除新测试。
- 完成定义：每个 blocker 至少一条可解释 RED。

## 任务 2：最小 fail-closed hardening

- 目标：失败全部发生在 connect/backup/stamp/DDL 之前。
- 前置条件：任务 1 RED。
- 输入：010/011 frozen candidate、012/013 exclusions、identity 014 contract。
- 输出：完整 schema/index validator、no-create path preflight、新增 015 exact guard、service strict。
- 涉及文件：authority/adoption/015、CLI/service、测试。
- 状态 / 数据变化：仅临时 SQLite；真实服务/DB 零变化。
- 验证命令与证据：RED→GREEN、合法 010/011 apply、重复/失败路径。
- 回滚边界：无库到 015 时可回滚 P5.1；已有库到 015 时先在当前代码下授权 downgrade 到 014，
  再回退代码；apply 中途失败则从 mandatory backup 恢复。
- 完成定义：未知/畸形 schema 不可获得 head 版本。

## 任务 3：收口与 packet gate

- 目标：形成可安全合入最新 ext 的 P5.1。
- 前置条件：任务 2 GREEN，远端 B 未漂移。
- 输入：完整 diff、测试/doctor 证据。
- 输出：CI summary、不可变 H、review-only R、no-ff candidate。
- 涉及文件：本 change record；GO 时仅新增 versioned report/approval。
- 状态 / 数据变化：Git 本地；GO 前不推送。
- 验证命令与证据：代表集、Ruff/compile、doctor、packet verifier。
- 回滚边界：candidate 未推前删除本地 merge；推后按 015→014 version-marker downgrade、
  再 revert remediation merge 的顺序执行。
- 完成定义：独立 `PACKET_REVIEW_GO` 且 push verifier 接受精确 B→H→R→M。

## 任务 4：回修 Claude HIGH normalization blocker

- 目标：CHECK/default 比较只规范化 SQL 语法，不改变引号内字面量。
- 前置条件：review-v1 GO 已被可复现 HIGH 覆盖失效，P6/ext 均冻结。
- 输入：`p5-1-check-normalization-blocker.md` 与 006/009 历史迁移。
- 输出：共享引号感知规范化器、精确历史 `FALLBACK` 默认、每函数一条大小写负例。
- 涉及文件：`backend/src/schema_adoption.py`、`backend/tests/test_unversioned_database_adoption.py`、本变更证据。
- 状态 / 数据变化：仅代码与临时 SQLite；无真实 DB/服务操作。
- 验证命令与证据：2 RED→2 GREEN、adoption 20/20、007–015 50/50、全量基线比对。
- 回滚边界：修复未合 ext；可 revert 新实现提交，禁止恢复 review-v1 GO 作为放行凭证。
- 完成定义：新精确 H 以 `PACKET_P5.1_READY_FOR_CLAUDE_REVIEW` 交付，等待独立 Claude GO。
