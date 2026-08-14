# EXT 能力资产盘点结论

## 范围

- 候选来源：`origin/feature-chaotang-ext`；固定 commit 见同目录 JSON 快照。
- 目标：生成快照时的 `ext-dev` HEAD；固定 commit 见同目录 JSON 快照。
- 范围：工程 Agent、顶层开发 Skill、控制面配置、`runtime_prompts` 和
  `agent_design/**/skills`。
- 本盘点只提供证据和迁移候选，不授予复制、注册、工具调用或产品执行权限。

## 机器结果

| 类型 | 文件/组件 | 唯一名称 | 唯一 Git blob | 结论 |
| --- | ---: | ---: | ---: | --- |
| 工程 Agent | 7 | 7 | 7 | 合并进当前 4 个工程角色，不新建 7 个重叠角色 |
| 顶层开发 Skill | 9 | 9 | 9 | 蒸馏为少量当前仓原生 Skill/rubric |
| 根/前端 Harness Agent | 2 | 2 | 2 | 只作治理参考，不恢复旧 `.harness` 权威 |
| 前端 Harness Skill | 9 | 9 | 9 | 与当前前端事实源逐项重写或淘汰 |
| 后端 Skill package | 9 | 9 | 9 | 与当前 Runtime Skills 做契约差异分析 |
| Persona Skill | 40 | 40 | 40 | 只作为评测镜头，不作为生产 authority |
| Harness 候选 Skill | 1 | 1 | 1 | 保持隔离，不因位于 harness 自动晋级 |
| 控制面文件 | 4 | 4 | 4 | 禁止直接复制 |
| 嵌套领域 Skill | 367 | 43 | 43 | 视为设计语料；36 种能力各复制 10 份 |
| Runtime role 组件 | 290 | 71 | 284 | 以角色包评测，不以单文件评测 |

机器清单总计 **738** 个分类条目。367 份嵌套 Skill 中，36 种各在十个部门复制一次，共 360 份；另有 7 份单例。除
`labor-lawyer` 的少量文本引用外，基本没有运行消费链，不能把文件库存当作生产能力。

71 个 Runtime role 中，67 个进入 flow 配置，70 个至少有代码或配置引用；`hermes_agent`
是唯一完全孤儿。只有 32 个角色被测试直接点名，而且多数属于配置/字符串检查，不是输出
质量评测。

上述重复、flow、引用和测试数字来自独立只读调查，不是 JSON 当前字段推导出的调用图。复现
时固定使用 JSON 中的 source commit，并运行：

```bash
git ls-tree -r <source-commit> -- backend/agent_design
git grep -l '<role-or-skill-id>' <source-commit> -- backend ':!backend/runtime_prompts/**' ':!backend/agent_design/**'
git grep -l '<role-id>' <source-commit> -- 'backend/config/flow_*.yaml' 'backend/tests/**'
```

正式晋级前应把引用图和测试覆盖变成单独的机器证据；当前盘点器只证明资产身份、内容指纹、
路径类别和精确重复度。

## 工程资产处置

| EXT 资产 | 处置 | 当前落点 |
| --- | --- | --- |
| `gongbu-chief-engineer` | Merge | `solution-architect`，保留原屏融合和风险分层 |
| `gongbu-backend-bridge` | Merge | `module-engineer` 的跨线契约检查 |
| `gongbu-e2e-inspector` | Improve + Merge | `test-engineer` 与真实关键旅程 |
| `gongbu-frontend-craftsman` | Merge | 当前前端规范与统一设计 Skill |
| `gongbu-loop-smith` | Retire implementation | 仅保留单一事实源、适配层、诚实来源原则 |
| `gongbu-quality-gate` | Improve + Merge | 自动断言、rubric 与 `test-engineer` |
| `gongbu-release-scribe` | Merge | `product-flow` 的交付证据契约 |
| 四个前端设计 Skill | Merge | 一个 DEV 原生前端设计与视觉验收 Skill |
| 三个用户画像 Skill | Merge | 参数化 UX 验收矩阵，不作为执行 Agent |
| `dept-capability-map` | Rewrite | 读取当前 Python Runtime/Tool registries |
| `chaotang-build-office` | Retire implementation | 未来基于当前 Runtime Skill 内核重新设计 |

禁止整搬根/前后端 `AGENTS.md`、`CLAUDE.md`、`.claude/`、hooks、settings 和旧 schema。
EXT 的 settings 含 Git 写操作与失效 Windows 绝对路径白名单，不能覆盖当前控制面。

## Runtime 角色风险

EXT 的 Prompt 编辑 API 使用全局 `backend/runtime_prompts`，虽然文档声称租户隔离，但实际
加载/保存没有 tenant/owner 级事实源隔离。任意已登录用户写全局 Prompt 会造成跨租户控制面
污染。旧系统还存在文案描述外部动作、工具、凭据或网络但执行权限未结构化绑定的问题。

因此禁止迁入：

- 全局可编辑 Prompt 目录；
- 旧 flow engine 或旧 registry 作为第二运行权威；
- 由 Prompt 自己声明工具权限、租户、owner、凭据、预算或审计状态；
- `no_tools` 只靠不加载 `TOOLS.md` 的提示词级限制。

## 两条独立晋级轨道

### 工程轨道：首批五项

1. 真实性与决策质量门；
2. DEV 原生能力地图；
3. 统一前端设计与视觉验收；
4. 真实 E2E 关键旅程；
5. 发布证据模板。

这些能力分别合并进当前工程工作流、测试角色或产品交付，不新增重叠 Agent。

### 产品 Runtime 预研轨道

1. `requirements_analyst`：无工具、结构清晰，最适合建立低风险基线；
2. `contract_counsel`：高价值、已有部分安全检查，必须保持非法律意见和人工复核；
3. `finance_risk`：可映射户部，需严格数字来源和资料不足规则；
4. `expert_review_gate`：蒸馏证据、阻断、责任和时限，不继承 PACK 专属外壳；
5. `executive_summary`：只压缩上游，重点评测忠实度、遗漏和幻觉。

每个 Runtime 候选至少需要 30 个离线案例，其中不少于 10 个对抗/缺证/失败案例；所有安全、
权限和租户断言必须 100% 通过，再完成不少于 20 次无副作用 shadow，才可讨论 1–5% canary。

## 治理漂移

当前工作树真实 `AGENTS.md` 要求的 `using-superpowers` 在可用技能和常见本地路径中不存在；
用户提供的外层项目说明提到的根 `.harness` 与 `scripts/execution-authority.mjs` 在当前 DEV 也
不存在。当前仓实际采用 `scripts/check_harness.mjs` 与 `.agents/.codex/.claude` 三客户端
控制面。正式迁移前必须明确哪套文档是当前 authority，并恢复或正式替代缺失入口。

## 证据

- 机器清单：`docs/migrations/2026-08-13-ext-capability-stocktake.json`
- 生成器：`scripts/stocktake_external_capabilities.mjs`
- 设计：`docs/superpowers/specs/2026-08-13-ext-capability-distillation-design.md`
