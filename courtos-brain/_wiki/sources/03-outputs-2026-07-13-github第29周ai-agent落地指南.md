---
name: source-03-outputs-2026-07-13-github第29周ai-agent落地指南
type: source
source_kind: raw
raw_path: /home/ubuntu/CourtOS-Brain/03-Outputs/2026-07-13-GitHub第29周AI-Agent落地指南.md
ingested_at: 2026-07-13
updated_at: 2026-07-13
schema_version: 1
---

# 03-Outputs/2026-07-13-GitHub第29周AI-Agent落地指南.md

## TL;DR

CourtOS 落地指南：采用 Herdr、Codex 插件、Watch/Claude Video、OfficeCLI 等工具，建立任务分工→隔离执行→双模型复核→产出文件→结果回写闭环；其余工具暂缓或按需启用。

## 关键事实

- 采用 Herdr 0.7.3 用于终端内并排看 Agent 状态
- Codex 插件更新至 1.0.6，用于独立 review/rescue
- Watch 0.2.0 安装，支持本地视频分析且无 API Key 时降级
- OfficeCLI 1.0.135 已有，用于生成周报 PPT 等文件推送
- Caveman 仅作为输出压缩器，不增强推理质量
- CourtOS 标准工作流包括新功能、视频学习、办公交付、安全检查

## 关联 concepts

- [[concepts/herdr]]
- [[concepts/codex-plugin-claude-code]]
- [[concepts/watch]]
- [[concepts/claude-video]]
- [[concepts/officecli]]
- [[concepts/caveman]]
- [[concepts/archify]]
- [[concepts/strix]]
- [[concepts/pentagi]]
- [[concepts/cubesandbox]]
- [[concepts/page-agent]]
- [[concepts/astryx]]
- [[concepts/courtos]]
- [[concepts/decision-brief]]

## 关联 entities

- [[entities/person/karpathy]] · Karpathy
- [[entities/person/charity-majors]] · Charity Majors
- [[entities/person/bruce-schneier]] · Bruce Schneier
- [[entities/person/kent-beck]] · Kent Beck
- [[entities/person/张小龙]] · 张小龙
- [[entities/tool/herdr]] · Herdr
- [[entities/tool/codex]] · Codex
- [[entities/tool/claude]] · Claude
- [[entities/tool/watch]] · Watch
- [[entities/tool/officecli]] · OfficeCLI
- [[entities/tool/caveman]] · Caveman
- [[entities/tool/desktopcommandermcp]] · DesktopCommanderMCP
- [[entities/tool/archify]] · Archify
- [[entities/tool/strix]] · Strix
- [[entities/tool/pentagi]] · PentAGI
- [[entities/tool/cubesandbox]] · CubeSandbox
- [[entities/tool/page-agent]] · Page Agent
- [[entities/tool/astryx]] · Astryx
- [[entities/org/github]] · GitHub

## 原文摘录

> ---
> type: decision-brief
> status: active
> created: 2026-07-13
> review_after: 2026-07-27
> source: "[[_wiki/sources/github-week29-ai-agent榜单]]"
> ---
> 
> # GitHub 第29周 AI Agent：CourtOS 落地指南
> 
> ## 结论先行
> 
> 本次采用“3 个立即可用、4 个按项目启用、7 个不重复/暂缓”的组合。目标不是收集 14 个工具，而是建立可验证的闭环：任务分工 → 隔离执行 → 双模型复核 → 产出文件 → 结果回写。榜单原始证据见 [[_wiki/sources/github-week29-ai-agent榜单]]。
> 
> ## 已落地并验证
> 
> | 能力 | 状态 | 验证 |
> |---|---|---|
> | Herdr | 新装 `0.7.3` | 官方 SHA256 通过；`courtos` 持久会话可启动、分离，后台仍运行 |
> | Codex plugin for Claude Code | `1.0.5 → 1.0.6` | Claude 插件更新成功；重启 Claude Code 后生效 |
> | Watch / Claude Video | Codex 端安装 `0.2.0` | 对 83 秒本地视频抽出 7 个去重关键帧；无 API Key 时安全降级为仅画面 |
> | OfficeCLI | 已有 `1.0.135`，且为当前 release | `officecli --version` 正常 |
> | Caveman | 之前已装 | 只把它当输出压缩器，不当推理质量增强器 |
> 
> Herdr 配置：`~/.config/herdr/config.toml`。Watch 配置：`~/.config/watch/.env`

---
*compiled by LLM-Wiki ingest · model=ollama-fast*
