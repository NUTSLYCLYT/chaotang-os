# 规格说明：chore-harness-architecture-doctor-20260709

## 背景

当前项目已采用 `chaotang-os` 三层 harness 架构，但健康检查还不够硬：Windows CRLF 的 skill 文件会误判，脚本/包脚本/模板契约未被检查，已交付 change 也可能偏离 11 阶段工作流。

## 范围

- 保留当前朝堂定制化 harness 架构。
- 让 `harness:doctor` 成为可靠的 Windows 兼容健康检查。
- 增加 doctor 检查：harness 脚本、package scripts、MCP JSON、模板完整性、skill 名称一致性、change 元数据、阶段状态、delivered 阶段文件。
- 补齐导致严格验证失败的历史审计记录。
- 将本次 harness 维护写入 `.harness/changes/`。

## 非目标

- 不整套复制参考项目。
- 不修改前端运行时行为。
- 不重写产品规则、skills 或 wiki 内容，除非是健康检查所需。

## 验收标准

- `pnpm harness:doctor` 通过，0 errors，0 warnings。
- skill frontmatter 同时支持 CRLF 与 LF。
- delivered change 有完整阶段文件，且没有遗留占位符。
- V1 module taxonomy 与 route-prune 变更拥有规范 summary 元数据。

## 风险

- 运行时风险低，因为只修改 harness 脚本和文档记录。
- 历史摘要不得夸大当时验证过的范围。

## 验证计划

- 运行 `node scripts/harness-doctor.mjs`。
- 搜索已触达 delivered change 中的遗留占位符与未渲染模板变量。

