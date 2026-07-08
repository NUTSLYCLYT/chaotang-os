# PR: feat/simplify-routes-b — 路由收敛 + 蜂群单 agent 产品化 + 丞相编排 + 两个天才设计

> 目标分支 `master` ← `feat/simplify-routes-b` · 领先 13 commits · +1416 / −414 · **0 冲突，可干净合入**
> HEAD 双闸全绿：`pnpm build` 193/193 · 全量 e2e 70/70 · 台账逻辑 verify 7/7。

## ⚠️ 合并前必读：这是一条多窗口共享分支
分支提交里混着多个窗口的工作（蜂群 / shangshufang EdictStage / 鉴权脚手架等）；**合并时刻工作区可能有别窗
未提交的 WIP**（如另一窗正在填三省 `three-chamber-engine.ts` / `court-pipeline.ts` / `orchestration/run`）。
**合 master 前务必：① 确认别窗 WIP 已落定或剥离；② 协调好再合，别把半成品卷进 master。**

---

## 一、路由收敛（减法 B）
多套并存的部门详情路由 → 单一 `/departments/[code]`（删 −877 行历史峰值），旧 `/manor-dept/:code` 307 转发。
6 契约部门由 `DEPT_DISPLAY` 派生；finance→专用 HubuClient（承载问责坞），gongbu/works/libu 保留别名 client。

## 二、蜂群单 agent 产品化（3 个 live 大臣）
原三院编排在产品里是**空壳**（`runZhongshu/menxia/shangshu` 占位零 LLM）；离线评测 11 部三院 2.58、单 agent 4.5+。
落地"对答案负责"的单 agent 到 **户部(真实 Turso) / 兵部 / 刑部(运营种子)**，五要素：单 agent 直答 · 数据源适配 ·
**算分离**(确定性计算) · **对答案负责 schema** · **确定性 number-verifier**(数字必须 grep 回 context，否则判幻觉)。
- **终止 gate**：重写后仍未接地 → UI 降级、不发"已校验"徽标。
- **决策 trace 台账** `agent_decisions`：每次 ask 落宽事件（trace + 黑板源 + 护城河失败子集 + outcome 底座）。
- **量产框架**：核心泛化（`dept-agent`/`dept-registry`/`dept-agent-meta`），**新增第 4 个部门 = 两条配置**。
- **问责面板 UI**：答案 + 证据 + 接地徽标(标注"仅溯源·非正确性") + 冲突声明；未接地显降级红横幅。

## 三、丞相编排（会审 6/6 处方落地，非重建官僚）
`POST /api/court/orchestrate`：**确定性 router**(关键词→部门子集，`source:'rule'`) → 并行召 live 部门 →
**确定性 merge 节点**：无冲突直接合并；两个【都接地】部门硬冲突 → **不裁决，伏候圣裁**(摊给老板，不伪造共识)；
终判逐字拼 grounded 原话、不引入新数字 → 继承 number-verifier。**没填三省空壳**(不造 2.58 孪生兄弟)。
- live 实测：跨域"粮草该不该批"→ 召 finance+ops、检测户部↔兵部硬冲突、escalate=True；单域→ 只召 1 部不过度编排。

## 四、两个会审天才设计（逻辑已用真数据证明）
- **🐜 Wilson 双向浓度场**（`decision-ledger`）：conflicts 从单向死痕迹 → 会**强化(+1)/蒸发(7天半衰)**的浓度场，
  蜂群反复撞的真断层线浮现并收敛，久未触碰的蒸发消失。注入下一轮 buildContext。
- **👑 Bezos 判断飞轮**（`boss-ledger` + `/orchestrate/sign-off`）：每次 merge 焊进 **SHA256 哈希链**(tamper-evident)，
  老板拍板(签/否/改+选哪侧)写回链 + 从真实选择累积偏好；下次同冲突边 merge 附"陛下历史 N/M 次选 X 部"学习先验，
  **绝不自动裁决**，越用越懂这位老板、完全可审计。
- **📡 台账健康端点** `GET /api/court/ledger/health`：把 Turso 静默降级变可见（DB 可达？各表几行？一句话诊断）。

## 五、大神顾问系统（工作方法，落进规则）
54 位 persona + 8 蜂群×2 常驻对 + 核心 6（`AGENTS.md §12`）；`persona-panel` 会审固化"每审 ≥1 战略大神"；
全局 `~/.claude/CLAUDE.md` 大神顾问层（实质回答带 🎲 视角 + 天才建议；会审共识必须落码）。

## 六、测试与验证
- [x] `pnpm build` 193/193 静态页 exit 0
- [x] 全量 e2e 70/70（含 3 部门问责面板 / 丞相确定性闸 / 路由收敛 / 安全回归）
- [x] `node tests/swarm-eval/orchestration/verify-ledgers.mjs` 7/7（真 file: 库证浓度场收敛 + 飞轮哈希链+学偏好）
- [ ] 跨域评估集（12 题已建）需可写库 + 真大脑 + human_pin 才能跑 → 回答 Bezos"编排值不值"

## 七、已知限制（诚实，非代码 bug）
- **dev 的 Turso 走 fallback 不可写** → 决策台账/浓度场/飞轮在 dev 无法 live（健康端点已实锤 dbReachable=false）；
  代码全绿、逻辑用真 file 库证过，**生产 Turso 可写即跑**。解锁的唯一动作 = 接一个可写库。
- **outcome 真值 / judge 人工一致率** 需真实使用回填，不可造（飞轮的燃料、评估的金标准）。
