# 任务：fix-canonical-release-artifact-entry-governance-20260714

## 任务 1：收编 canonical release artifact，并登记入口治理

- 目标：让旧 `chaotang-web-lyt` package 身份转入统一工程发布身份，同时让所有已知旧入口进入可审计清算流程。
- 前置条件：生产保持 STOP；不删除入口；用户已批准本最小纵切。
- 输入：旧 packager、三个已知旧入口、根 harness manifest。
- 输出：`chaotang-os-frontend` tar/manifest；inventory、schema、wiki、doctor gate。
- 涉及文件：`frontend/scripts/package-release*`、根 `.harness/{contracts,manifest,wiki}`、`scripts/harness-doctor.mjs`、change records、launch blueprint。
- 状态 / 数据变化：旧 release identity 为 `MIGRATED_OBSERVE`；另两个入口为 `MIGRATE_REQUIRED`；无数据库和线上状态变化。
- 验证命令与证据：CI summary 中的 RED/GREEN、package、43 pytest、doctor、prod STOP。
- 回滚边界：反向恢复本提交；生成物位于 gitignored `frontend/dev/artifacts/release/`，不部署。
- 完成定义：一个旧入口完成 RED→GREEN；治理处于 `OBSERVE`；没有入口被错误标成可删除。
