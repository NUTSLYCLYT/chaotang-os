---
type: decision-brief
status: active
created: 2026-07-13
review_after: 2026-07-27
source: "[[_wiki/sources/github-week29-ai-agent榜单]]"
---

# GitHub 第29周 AI Agent：CourtOS 落地指南

## 结论先行

本次采用“3 个立即可用、4 个按项目启用、7 个不重复/暂缓”的组合。目标不是收集 14 个工具，而是建立可验证的闭环：任务分工 → 隔离执行 → 双模型复核 → 产出文件 → 结果回写。榜单原始证据见 [[_wiki/sources/github-week29-ai-agent榜单]]。

## 已落地并验证

| 能力 | 状态 | 验证 |
|---|---|---|
| Herdr | 新装 `0.7.3` | 官方 SHA256 通过；`courtos` 持久会话可启动、分离，后台仍运行 |
| Codex plugin for Claude Code | `1.0.5 → 1.0.6` | Claude 插件更新成功；重启 Claude Code 后生效 |
| Watch / Claude Video | Codex 端安装 `0.2.0` + Bilibili 回退 | Bilibili 412 时改走公共 API；真实 URL 抽出 7 个去重关键帧；完整测试 `73 passed` |
| OfficeCLI | 已有 `1.0.135`，且为当前 release | `officecli --version` 正常 |
| Caveman | 之前已装 | 只把它当输出压缩器，不当推理质量增强器 |

Herdr 配置：`~/.config/herdr/config.toml`。Watch 配置：`~/.config/watch/.env`；默认 `balanced`，未写入任何 API Key。Bilibili 无字幕视频仍只有画面；如需自动语音转写，再由用户自行加入 Groq/OpenAI Whisper Key。

## 14 项采用矩阵

| 项目 | 决策 | CourtOS 用法/理由 |
|---|---|---|
| Orca | 暂不装 | 与 Herdr 高度重叠；需要桌面/手机控制时再二选一评估 |
| Herdr | **采用** | 终端内并排看 Codex/Claude/其他 Agent，状态优先排序 |
| codex-plugin-cc | **采用，已更新** | Claude 负责实现时让 Codex 做独立 review/rescue，反之亦然 |
| DesktopCommanderMCP | 不全局装 | Codex 已有文件和终端能力；再开放一个全盘 MCP 只会扩大权限面 |
| Caveman | 已有，限制使用 | 仅在状态播报、commit、review 摘要中压缩；需求、架构、验收不得 ultra |
| claude-skills | 不整包安装 | 现有技能已经很多；345+ 技能会增加重复路由和上下文噪声，只按缺口挑单项 |
| claude-video / watch | **采用** | 学教程、分析竞品视频、读 bug 录屏；默认 balanced，敏感本地视频用 `--no-whisper` |
| Archify | 按项目启用 | 需要给人看的架构图时装；事实来源仍应是代码、接口契约和 ADR |
| Strix | 按授权项目启用 | 发布前对自有/明确授权目标做安全扫描，结果必须人工复核 |
| PentAGI | 暂缓 | 自动渗透、约 20GB、Docker 管理面权限高；只在专用靶场启用 |
| CubeSandbox | 第二阶段候选 | 本机有 `/dev/kvm`，条件满足；等高风险代码执行需求出现后单独部署和压测 |
| OfficeCLI | **采用，已有** | 将周报、经营表、汇报 PPT 变成可测试的文件生成流水线 |
| Page Agent | 按前端项目启用 | 给 CourtOS 管理后台增加自然语言操作；不能替代 Playwright 验收测试 |
| Astryx | 新 React 项目候选 | 用机器可读组件契约降低 Agent 虚构 props；现有项目不强迁移 |

## CourtOS 标准工作流

### 1. 新功能：减少前后端对不上

1. 在主仓库先固定 API/schema、错误码和验收测试。
2. 在 Herdr 里开三个 pane：`实现`、`测试`、`独立审查`。
3. 实现 Agent 只能依据契约写前后端；测试 Agent 先写失败用例；审查 Agent 只看 diff、契约和测试证据。
4. Claude Code 中运行 `/codex:review --background`；完成后用 `/codex:status`、`/codex:result` 收结果。
5. 只有编译、单测、接口契约测试和关键 UI 流程全绿，才写入 Obsidian 的“已完成”。

### 2. 视频学习：把教程变成行动

在 Codex 中说：

> 使用 `$watch` 观看这个视频。先列可验证事实，再列对 CourtOS 的能力缺口；只推荐最多 3 个项目，并给安装成本、安全边界和烟雾测试。

本地敏感录屏：

> 使用 `$watch` 分析 `bug.mp4`，加 `--no-whisper`，定位首次异常时间和 UI 状态，不上传音频。

### 3. 办公交付

> 使用 `$officecli` 根据 `03-Outputs/本周决策.md` 生成周报 PPT；每页一个结论，附证据路径；生成后渲染检查溢出、空页和图表数据。

### 4. 安全检查

Strix/PentAGI 只允许以下输入：自有本地服务、测试环境或书面授权目标。流程是“基线扫描 → 人工确认 → 最小修复 → 回归测试”，禁止把自动发现直接当作真实漏洞结论。

## 大神案例

### Karpathy：让 Agent 读契约，不读愿望

案例：先把 OpenAPI、类型、数据库迁移和验收样例变成机器可读事实，再让前端与后端 Agent 并行。Astryx 的价值也在这里：组件 API 可被 Agent 查询，减少虚构属性。衡量指标不是生成代码行数，而是首次集成通过率和返工次数。

### Charity Majors：每个 Agent 都必须留下可观察证据

案例：Herdr 不是为了同时开十个窗口，而是让人一眼看出谁在工作、谁被阻塞、谁已完成。每个任务必须输出测试结果、diff、日志或可复现命令；没有证据的“完成”一律视为未完成。

### Bruce Schneier：能力越大，隔离越先

案例：普通代码生成可在 worktree；未知依赖和不可信脚本进 Docker；真正高风险、并发执行再进入 CubeSandbox。DesktopCommander、PentAGI 这类高权限工具不因方便而全局常驻。

### Kent Beck：用红—绿—重构约束多 Agent

案例：测试 Agent 先制造一个明确的红灯，实现 Agent 只负责变绿，审查 Agent 检查是否投机绕过。这样多 Agent 是角色分离，不是三个人同时改同一批文件。

### 张小龙：默认路径必须比功能列表更简单

案例：日常只记三个入口：`herdr --session courtos`、`$watch`、`$officecli`。其余项目在明确场景触发，不把 14 个名字都变成用户负担。

## 立即使用

```bash
# 进入已创建的 CourtOS 持久会话
herdr session attach courtos

# 查看会话
herdr session list --json

# 完全停止该会话（不会删除配置）
herdr session stop courtos
```

Herdr 内：`Ctrl+B` 后按 `v` 竖分屏，按 `-` 横分屏，按 `q` 分离会话；新 pane 中直接运行 `codex` 或 `claude`。

## 验收与反馈

- 两周内至少用 Herdr 完成 3 次真实开发任务。
- 记录：首次集成通过率、人工返工次数、Agent 阻塞时间、工具误报数。
- 若 Herdr 没有减少切换成本，停止后台会话并评估 Orca；若高风险执行超过每周 3 次，再启动 CubeSandbox 专项。
- 结果回写到本页“验收与反馈”，并更新 [[_wiki/sources/github-week29-ai-agent榜单]] 的 `待验证` 判断。
