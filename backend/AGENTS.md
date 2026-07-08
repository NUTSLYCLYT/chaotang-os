# AGENTS.md — jiqun_ai 协作收口规则

本文件约束仓库根目录下的所有工作。目标是减少“偏移、脏码堆积、无用功、无法合并”。

## 主线仓职责边界（最高优先级）

本仓只承接 **后端 / 蜂群 / flow / agent / harness / 质量基线 / 真实客户样本**：

- ✅ `config/flow_*.yaml`、`src/prompts_*.py`、`src/flow_engine.py`、agent 设计、provider 路由、质量门禁。
- ✅ `harness/`、golden cases、failure samples、business ledger、real-run / dry-run / eval_ci / validate_flows。
- ✅ 兵部销售与售后战情：`haolong`、`voice_sales`、`opc`、`quotation`、`storage_aftercare` 的后端链路与评分。
- ✅ 史馆归档、锦衣卫观测、钦天监参谋、刑部/御史红线、三省控制流程的后端证据链。
- ❌ 不在本仓改 `chaotang-web-lyt` 的页面、组件、样式、导航、E2E、Next.js build 产物。
- ❌ 不用后端 dry-run 替代前端真实浏览器验证。
- ❌ 不把 Web 发布修复混进蜂群/flow 提交。

如果任务本质是页面、网站体验、浏览器验证、发布门禁，回 `/home/ubuntu/workspace/frontend/chaotang-web-lyt`。
如果任务本质是顶层产品设定文档，只读参考 `/home/ubuntu/court-agent-os`，不要在这里维护第二份网站规则。

## 朝堂开发效率系统

默认按 `docs/chaotang_execution_protocol.md` 工作，把用户需求分成四种模式：
- 直接做：小修、测试、文档、脚本，直接进入实现 + 验证 + 收口。
- 先审查：问题还乱、方向不明、怀疑偏移，先读现状再给最小修复路径。
- 开钦天监：上线、生产、客户承诺、不可逆、花钱、架构分叉。
- 只解释：用户在学习概念，不默认改代码。

任务模式可用 `python scripts/chaotang_task_protocol.py "<用户任务>"` 辅助判断。Codex 能力边界见 `docs/codex_capability_map.md`。

下载用户和后续 agent 的能力建设入口见 `docs/shiguan/README.md`。凡是新沉淀的 Claude/Codex 协作能力、开发协议、收口规则、飞轮机制，优先补进 `docs/shiguan/capability_manifest.md`，避免只留在聊天记录里。

## 每次改动必须先定边界

开始动手前先确认本轮目标，默认只改与目标直接相关的源码、测试、prompt 或文档。

不要把以下内容混进功能提交，除非用户明确要求：
- 运行产物：`data/*.db`、`data/default/runs/`、`reports/`、`sessions/`、`swarm_sessions/`
- 环境漂移：`.env`、本机 provider/API key 配置、临时端口配置
- 临时实验：一次性脚本、下载结果、模型评分日志

## 每次收尾必须给出收口模板

每次做完实质改动后，最终回复必须包含以下 5 项：

1. 目标：本轮原本要解决什么问题。
2. 应提交文件：哪些文件属于本轮改动，建议进入 commit。
3. 不应提交文件：哪些 dirty files 是运行产物、环境漂移或无关改动。
4. 验证命令：本轮实际跑过哪些检查；没跑的也要说明原因。
5. 回滚方式：如果这轮改动要撤销，优先撤哪些文件或哪个提交。

模板见 `docs/commit_closeout_template.md`。

## Git 操作纪律

- 默认不要 `git add .`，用文件级 `git add <path>` 精确分拣。
- 提交前先跑 `python scripts/commit_closeout_check.py`。它会把“应提交候选”和“运行产物/环境漂移/生成质量基线”分开列出。
- 如果 `python scripts/commit_closeout_check.py --staged-only` 红灯，说明高风险文件已经进暂存区，必须先 `git restore --staged <path>` 移出。
- 不要回退用户已有改动，除非用户明确要求。
- 不要用 `git reset --hard` 或 `git checkout -- <path>` 做清理，除非用户明确点名。
- 如果工作区已有无关脏文件，只列出来并说明，不要擅自处理。

## 脏码分拣红线

以下文件默认只留本地，不进功能提交：
- `config/providers.yaml`：本机模型/provider 选择，属于环境漂移。
- `data/`、`memory/`、`events/`、`swarm_sessions/`：运行产物。
- `config/_generated/`：生成配置，除非本轮目标明确是发布该生成物。
- `scripts/golden_cases/quality_baseline.json`：质量基线必须单独提交；提交前先跑完整 `python scripts/validate_flows.py`，不能用失败基线收口。

## 登录后资源策略

用户登录后默认可使用朝堂资源，但不能静默替换用户自己的资源。资源策略见 `docs/shiguan/resource_profile_policy.md`：
- 默认：`chaotang_default`，朝堂协议、史馆、钦天监、收口护栏和默认蜂群直接可用。
- 用户有私有 provider/知识库/偏好时，推荐 `hybrid`，朝堂资源做底座，用户资源叠加。
- 用户明确要求只用自己的资源时，使用 `user_own`。
- 删除、覆盖、迁移用户资源属于不可逆动作，必须人工签字。

## 推荐提交粒度

一个 commit 只表达一件事。常见拆法：
- 源码行为修复
- 测试补充
- prompt/规则调整
- 文档/流程模板
- 运行数据或基线更新

如果一次工作里出现多类变化，优先建议拆成多个 commit。

## 钦天监：重大问题前置参谋

“钦天监”用于重大、复杂、不可逆或容易偏移的问题：先观天象、定吉凶、给选项，再决定是否执行。它不是日常默认流程，避免把每个小问题都搞重。

触发方式：
- 用户明确说：`开钦天监`、`钦天监参谋`、`先问钦天监`
- 或任务明显属于不可逆/烧钱/架构分叉/多蜂群治理/上线发布/客户承诺

触发后，先不要直接执行。先输出一组前置参谋，格式见 `docs/qintianjian.md`：
- 最多先问 3 个“现在必须定”的问题，其余折叠为“稍后再定”
- 每个问题必须用通俗语言解释，避免术语堆叠
- 给用户情绪价值：说明“你不需要一次答完，我们先做最小可判断版本”
- 如果用户可能答不上来，必须让 2 位相关大神先给 2-3 个可选答案，并标注推荐项
- 每个选项说明会改变什么决策、如何验证
- 最后给出推荐执行顺序和下一步最小行动

用户确认后，再进入实现、评测或蜂群执行。
