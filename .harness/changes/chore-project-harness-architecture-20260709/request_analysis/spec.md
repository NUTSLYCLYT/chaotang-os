# 规格说明：chore-project-harness-architecture-20260709

## 背景

项目此前已经有较完整的前端 `.harness/`，也有大量后端运行/评测 harness，但缺少能代表整个 `chaotang-os` 仓库的根级 harness 架构。

## 范围

- 新增根级项目 harness 操作系统。
- 定义前端、后端、文档的所有权边界。
- 新增可机读的项目 harness manifest。
- 新增根级 doctor，验证根项目、前端、后端 harness 清单与文档入口。

## 非目标

- 不移动后端 harness 包。
- 不替换前端 `.harness/`。
- 不运行高成本真实模型 harness。

## 验收标准

- 根 `AGENTS.md` 与 `README.md` 指向 `.harness/`。
- 根 `.harness/` 包含 owner、rules、wiki、manifest、template 与 change 记录。
- 根 doctor 委托前端 doctor，并验证后端 harness 清单。
- 根 doctor 通过。

## 验证计划

- `node scripts/harness-doctor.mjs`
