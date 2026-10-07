# G3 受保护 CI 治理修复（2026-10-07）

## Status

Ready

## Product Definition

- 目标：让 G3 候选在 Linux CI 上得到与本地真实运行一致的验证结果。
- 用户价值：发布前能真实确认前端入口可启动、后端隔离测试未被环境缺失掩盖。
- 非目标：不改变业务流程、模型路由、权限、数据格式或公开部署。

## Purpose

收口 G3 产品候选的两个 CI 环境合同：前端 standalone 入口 smoke 必须检查真实朝堂首页标识；后端 Linux runner 必须安装项目 runtime-lock 测试所需的官方 `bubblewrap` 包。

## Affected Modules

- 模块：GitHub Actions 验证环境与前端入口 smoke 合同
- 允许路径：`.github/workflows/harness.yml`、本任务文件

## Acceptance Criteria

- [ ] GitHub `validate`、`backend`、`frontend` 和 `integration` 全部通过。
- [ ] runtime-lock 的 bwrap 进程隔离测试真实执行并通过。
- [ ] frontend standalone smoke 返回 200，并检查真实页面标识“朝堂 OS”。
- [ ] 六部 Runtime 就绪证据的受控 fingerprint pair 与新 workflow 一致。
- [ ] 失败时可回退到父提交 `fa2c0546f516956f21204899edd24a6eda235087`。

## Delivery Constraints

- 仅允许修改本任务登记的受保护 CI 文件、Harness fingerprint pair 和本任务文件。
- 不降低测试标准，不将 bwrap 测试改成跳过，不伪造 CI 证据。
- 不调用真实模型、不访问生产数据、不执行部署或合并。

## Technical Plan

1. 在 Ubuntu runner 安装官方 `bubblewrap` 包。
2. 使用 `npm run start` 启动已构建的 standalone server。
3. 将 smoke 标识改为真实首页标题片段 `朝堂 OS`。
4. 将新 trusted-spine runtime fingerprint 加入闭合兼容对，并更新自测数量断言。
5. 在隔离工作树运行 Harness、前端构建和本地 HTTP smoke，随后推送候选分支等待 GitHub CI。

## Scope

- 只安装 Ubuntu runner 的发行版 `bubblewrap` 包，不降低 runtime-lock 测试标准，不跳过任何测试。
- 只将前端 smoke 从失效的 `next start`/旧标识改为已构建的 standalone server 和真实页面标识。
- 不修改业务 API、模型调用、权限、Harness authority、数据库契约或部署配置。

## Acceptance

- GitHub `validate`、`backend`、`frontend` 和 `integration` jobs 全部通过。
- backend runtime-lock 三个 bwrap 测试真实执行并通过。
- frontend standalone smoke 通过并检查页面真实标识“朝堂 OS”。
- 本地 `node scripts/check_harness.mjs` 通过；失败时回退到父提交 `fa2c0546f516956f21204899edd24a6eda235087`。

## Rollback

回退本分支提交即可恢复现有 workflow；不涉及数据迁移或运行时外部状态。

## Implementation Report

待隔离分支完成本地验证和 GitHub CI 后填写；未通过前不宣称 G3 完成。

## Acceptance Review

翰林院需检查 CI 的四个 job 和本地证据，确认 bwrap 是真实安装并执行，确认前端 smoke 没有使用占位文本；史馆记录本次 CI 环境治理与回退 SHA。
