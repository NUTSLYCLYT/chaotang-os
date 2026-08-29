# Tenant Principal V1 Exact15 Credential Guard Corrective Successor Plan

任务：`TENANT-PRINCIPAL-V1-EXACT15-CREDENTIAL-GUARD-CORRECTIVE-SUCCESSOR-20260829`

基线：`291733a874ffa441949c74ce56fe5f83753689c4` / tree `033b2c4557b21dc9a49ea4f6b76c5815ff0cb5b8`

Approval RFC 8785 canonical digest：`sha256:e66e50aca5113d4a225b070260165a085dba432c295b161ca710f457b23dab7d`

状态：`PLAN_ONLY / NON_AUTHORIZING / COMMIT_GUARD_CORRECTIVE`

## Goal

保留已经通过完整矩阵与三审的 exact15 字节，固定十四条 blob，仅在唯一测试内改用进程级随机 credential 关闭 hardcoded-value 命中；不跳过、不修改、不放宽守卫。

## Dependency DAG

`291733a8 scheduler-contract approval (GO, commit hook STOP, no child)` → `credential-guard corrective approval` → `fixed14+corrective1 candidate` → `hooks` → `machine verify` → `FF push`。

predecessor authority：`ABANDONED_UNCONSUMED / REISSUE_REQUIRED / NO_REANCHOR`；旧候选与验证只作 donor evidence。

## Exact Paths

- Final scope：同一 exact15，`15 M / 100644`。
- Fixed14：除 `backend/tests/test_shiguan_migrations.py` 外，必须匹配 Task donor blobs。
- Corrective1：仅 migration test；必须离开 `a1cc05c9…`。
- Donor bundle：`sha256:1860ba0415ae7a6a9fb5ef36f9f8dc247c24a3195689ed1d652f79351677e0cd`。
- Donor full-index diff：`sha256:a2584159b3a47db2ab6e94b4b01c025c51256103a8d4136f911532327f314869`。

## RED Phase

1. 新基线重物化 donor exact15并复核身份。
2. 暂存 exact15，运行现有 credential guard。
3. 必须只命中 migration 正向测试中直接传给 `hash_password` 的硬编码登录值；其他失败或多重命中立即 STOP。

## GREEN Phase

1. 在唯一测试内生成 `login_value = secrets.token_urlsafe(32)`，同一变量用于 `hash_password` 与登录正例。
2. 证明该值不读环境、不输出、不持久化明文，迁移/登录正例通过。
3. 重新暂存，现有 guard 与完整 commit hooks 必须自然通过。
4. 不修改守卫、配置、生产代码、fixed14或第十六路径。

## Verification

- credential guard RED→GREEN与同一随机值 hash/login 链。
- migration same-principal正例及相关 ambiguity负例。
- exact15 focused、Ruff、POSIX temp backend-full。
- committed/clean candidate runtime-lock三路 full shard与全Ruff。
- exact15 fixed14/corrective1结构门。
- Harness、自测、Doctor、hook、Authority regression、V2、diff-check。
- Code、Python/DB、Security三路只读审查。

## Non-Goals

不更改凭据守卫、hooks、Git config、Harness、authority、生产代码、fixed14、schema、runtime-lock、前端、Pilot、发布或部署。

## Stop Conditions

远端漂移、machine STOP、RED非唯一、随机值来自环境或被输出/明文持久化、范围扩大、fixed14漂移、hooks/矩阵失败或审查 P0–P2，立即停止。只允许普通 fast-forward，不部署。
