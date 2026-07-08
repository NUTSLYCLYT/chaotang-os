# CourtOS Mainline Ledger

日期：2026-06-21

本文件是朝堂项目当前主线总账。它不替代具体 PRD、UI 方案或后端方略，只负责钉住：主仓、边界、北极星、P0 闭环、当前资产、风险和下一步任务。

---

## 1. 北极星

让 1 个真实老板，用朝堂 OS 真做成 1 件经营决策，并愿意说“这帮我了”。

当前只追一条真实闭环：

```text
上书房今日预案
-> 丞相筛选 / 已办 / 待补证
-> 交军机处会审
-> 生成合法奏折
-> 老板裁决
-> 高风险确认门
-> 史馆归档
-> 下次可引用旧案
```

这条闭环优先级高于继续堆页面概念、继续扩部门电影屏、继续增加蜂群数量。

---

## 2. 主仓锚点

| 角色 | 路径 | 职责 |
|---|---|---|
| 前端主仓 | `/home/ubuntu/workspace/frontend/chaotang-web-lyt` | 页面、体验、Next.js BFF、浏览器验证、发布门禁 |
| 后端主仓 | `/home/ubuntu/fe/fengQun/jiqun_ai_fresh` | 蜂群、flow、agent、prompt、provider、质量基线、真实后端逻辑 |
| 历史参考 | `/home/ubuntu/court-agent-os` 及其他旧目录 | 只读参考；不是当前开发主线 |

硬规则：

- 前端、页面、浏览器验证、Web 发布只在 `chaotang-web-lyt` 做。
- 后端、蜂群、flow、agent 运行逻辑只在 `jiqun_ai_fresh` 做。
- 搜到旧目录相似代码时，只能当历史参考；没有明确指令，不在那里改代码、跑主验证、提交或合并。

---

## 3. 当前主线状态

### 前端

- 主仓：`/home/ubuntu/workspace/frontend/chaotang-web-lyt`
- 当前有大量未提交工作，不能随意清理、格式化或混提交。
- 主线产品文档已经明确：先跑通 P0 真实老板裁决闭环，再扩部门电影屏。
- UI 方向已经明确：电影级 AI 决策操作系统，但业务信息必须在前，DEMO/FALLBACK 必须明示。

### 后端

- 主仓：`/home/ubuntu/fe/fengQun/jiqun_ai_fresh`
- 后端蜂群注册表修复已提交：
  - commit：`a2ec7da fix(jiqun): align registry validation and smoke failure semantics`
  - 正式注册蜂群：17
  - `validate_flows.py`、`validate_registry_sync.py`、相关单测和收口检查已通过
- `bingbu_sales_acquisition` 当前不在正式注册表；未来恢复前必须补齐 flow、runtime prompts、source/tests。
- `battery_stage_gate` 当前使用合法冻结空 `retrieved_snapshot`；知识库灌好后可重跑升级为真实快照。

### 方法论

- `front-100-workflow` skill 已沉淀为本地 Codex 技能。
- 用户说“顶尖大神”“下一步”“前100”时，应自动切换到：判断真实目标、限定范围、最小行动、验证标准、可执行提示词。

---

## 4. P0 闭环任务

| 阶段 | 目标 | 成功定义 |
|---|---|---|
| P0-A | 上书房首屏收口 | 老板 10 秒知道今天最该裁什么 |
| P0-B | 丞相处理与交军机处 | 低风险已办，复杂事项可转会审 |
| P0-C | 合法奏折与裁决 | 奏折字段齐全，裁决动作可持久化 |
| P0-D | 史馆归档 | 刷新后不丢，后续相似问题可引用旧案 |

P0 验收标准：

- 今日预案控制在 3-5 件，其余事项进入丞相侧栏。
- 用户可见结论必须带 `sourceLabel`。
- DEMO/FALLBACK/SYNTHETIC 不得伪装成 LIVE。
- 高风险动作必须进入人工确认门。
- 裁决动作至少包含：采纳、补证、复核、驳回、追问。
- 正式裁决必须可归档，并能按 `taskId` 查回。

---

## 5. 已有关键资产

### 产品与闭环文档

- `docs/COURTOS_IMPLEMENTATION_PLAN_2026-06-19.md`
- `docs/COURTOS_PM_USER_STORY_PACK_2026-06-19.md`
- `docs/PRD_PM_CourtOS_2026-06-13.md`

### UI 与审美系统

- `docs/CHAOTANG_WORLD_CLASS_UI_PLAN_2026-06-19.md`
- `docs/CHAOTANG_WEB_LYT_ADVISOR_SKILL_SYSTEM.md`
- A 级资产：`public/shangshufang/*`、`public/assets/libu/*`、`public/assets/six-ministries/*`、`public/assets/dadian/*`

### 后端与蜂群治理

- `config/jiqun_registry.yaml`
- `config/swarm_orchestrator.yaml`
- `scripts/validate_flows.py`
- `scripts/validate_registry_sync.py`
- `scripts/commit_closeout_check.py`
- 后端方略：`/home/ubuntu/fe/fengQun/jiqun_ai_fresh/docs/chaotang_backend_grand_strategy_2026-06-10.md`

---

## 6. 当前最大缺口

1. **前端未提交工作较多。**
   下一轮任何实现前，必须先分拣前端 dirty files，避免把页面、API、VAM、部门学习、素材混进一个提交。

2. **P0 闭环还需端到端核验。**
   文档里定义了“上书房 -> 军机处 -> 奏折 -> 裁决 -> 史馆”，但仍需要以真实 `taskId` 跑通并截图/测试确认。

3. **前端 11 朝堂角色与后端 17 蜂群需要继续桥接。**
   前台只暴露部门与圣旨；后台蜂群不能直接泄露成老板视角的产品概念。

4. **VAM 与朝堂的边界需要保持清晰。**
   VAM 负责事实生产和人物验证；前端负责展示与任务入口，不能把 VaM 自动化脚本混进前端主仓。

5. **文档过多，需要总账做入口。**
   后续新 agent 先读本文件，再按需要读具体 PRD/实施计划/AGENTS.md。

---

## 7. 不做清单

- 不继续堆新概念页面，直到 P0 真实裁决闭环跑通。
- 不把 fallback/demo 包装成真实经营建议。
- 不在前端仓实现真实报价、BOM、交期、付款、对外承诺等产线 flow。
- 不在后端仓改前端页面、样式或浏览器体验。
- 不在旧目录继续开发主线。
- 不一次性重构多个模块。
- 不新增 UI 框架或无关依赖。
- 不用 mock 分数证明真实后端蜂群可用。
- 不用前端浏览器验证替代后端 flow/quality gate。

---

## 8. 下一轮任务队列

### P0-1：前端 dirty files 分拣

目标：只读分组当前前端未提交改动，分成“P0 闭环相关 / VAM 同步 / 部门学习 / UI 资产 / 无关或待确认”。

验收：

- 输出每组文件清单。
- 不修改、不提交、不删除。
- 给出最小可提交批次建议。

### P0-2：上书房真实闭环核验

目标：确认上书房是否已经具备真实 `taskId`、奏折、裁决动作、归档入口。

验收：

- 只读检查路由/API/契约/持久化层。
- 输出缺口表，不自动开发。
- 给出最小实现任务。

### P0-3：P0 任务卡落成工程任务

目标：把 CT-P0-01 到 CT-P0-06 拆成可交给 Codex 的小任务，每个任务有文件范围、验收命令和回滚方式。

验收：

- 每个任务不超过一个清晰提交。
- 明确哪些文件不能碰。
- 每个任务都带浏览器或测试验证方式。

### P1：六部电影屏样板

目标：等 P0 真实闭环稳定后，再从礼部、锦衣卫、钦天监做三页样板。

验收：

- 复用现有 design tokens 和资产。
- 通过桌面/手机截图。
- 不牺牲老板 3 秒理解重点。

---

## 9. 可直接交给 Codex 的下一步提示词

```text
顶尖大神模式：请对前端主仓做一次只读 dirty files 分拣。

范围：
/home/ubuntu/workspace/frontend/chaotang-web-lyt

要求：
1. 不修改任何文件。
2. 不提交。
3. 不启动服务。
4. 不删除、不清理、不格式化。
5. 读取 git status、文件路径和必要 diff 摘要。
6. 把当前未提交改动分成：
   - P0 裁决闭环相关
   - VAM / 人物 / 资产同步相关
   - 部门学习 / advisor / real-source 相关
   - UI 资产和页面骨架相关
   - 无关或待确认
7. 输出建议提交批次，每批说明验证命令和风险。
8. 如果发现本轮之外高风险文件，只报告，不处理。
```
