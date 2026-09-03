# 智能体组织操作系统 V1 · 军机处专项骨架 amendment 草案

状态：`DRAFT_ONLY`

本目录只记录下一轮候选 amendment，不授权产品实现、不授权 commit、push、merge 或 deploy。

## 目标

把“用户目标 → 军机处设立专项 → 丞相生成项目纲领 → 组建项目组 → 任务卡和验收标准投影”的最小闭环接入现有朝堂主线。

## 范围

- 新增或扩展 `ProjectOrganization` 数据契约。
- 新增军机处“设立专项” UI/API 骨架。
- 支持从既有 `SceneRun` 创建专项。
- 展示项目组成员、责任矩阵、任务卡、缺失项、风险、验收标准和下一步。
- 复用现有丞相、军机处、六部、Scene Pack、证据、质量门和史馆主链。

## 明确非目标

- 不实现外部 provider 调用。
- 不实现工部真实 Codex / Claude Code / DeepSeek Harness 调用。
- 不新增第二套 Agent 系统、第二套任务事实源或第二套能力池。
- 不自动交易、签约、付款、群发、报价发送、对外发布、推送、合并或部署。

## 下一步

需要 Product Owner 对本草案形成 exact amendment digest、exact base、允许路径、验收命令和候选提交流程后，才能进入产品施工。
