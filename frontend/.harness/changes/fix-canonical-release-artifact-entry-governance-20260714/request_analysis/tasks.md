# 任务拆解

## 任务 1：发布包身份收编

- 目标：让 release package 只声明 `chaotang-os-frontend`。
- 输入：`scripts/package-release.mjs`。
- 输出：canonical tar/dir/manifest/INSTALL 与一条契约测试。
- 验收：1 RED→1 GREEN；实际 package build 通过。
- 依赖：现有 Next standalone build 与根 capability inventory。
