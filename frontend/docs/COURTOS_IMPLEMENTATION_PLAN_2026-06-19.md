# CourtOS Implementation Plan

日期：2026-06-19  
输入文档：
- `docs/COURTOS_PM_USER_STORY_PACK_2026-06-19.md`
- `docs/PRD_PM_CourtOS_2026-06-13.md`
- `docs/NORTHSTAR_REAL_LOOP_V1_PRD.md`

目标：先跑通一条真实老板决策闭环，再扩部门电影屏。不要继续堆页面概念，先让老板完成一次“看见重点 -> 读懂奏折 -> 做出裁决 -> 史馆留痕”的真实动作。

---

## 1. 北极星

让 1 个真实老板，用朝堂 OS 真做成 1 件经营决策，并愿意说“这帮我了”。

本轮只追求一个可验收闭环：

```text
上书房今日预案
-> 丞相筛选/已办/待补证
-> 交军机处会审
-> 生成合法奏折
-> 老板裁决
-> 高风险确认门
-> 史馆归档
-> 下次可引用旧案
```

---

## 2. 架构决定

1. **先 P0 真闭环，后 P1 部门扩展。**  
   礼部电影屏样板可以继续打磨，但不能替代“裁决落库 + 史馆归档”的主线验收。

2. **类型和状态只从现有 SSOT import。**  
   不新增平行契约。Loop 相关代码必须沿用：
   - `src/lib/reality/reality-state.ts`
   - `src/lib/contracts/task.ts`
   - `src/lib/contracts/{memorial,decree,archive,chancellor-decision}.ts`
   - `src/features/governance/lib/gate.ts`
   - `src/lib/db/{primary-store,schema,turso}.ts`
   - `src/lib/llm/router.ts`

3. **AI 调用只能经 Harness 薄壳。**  
   UI 组件和随手 API route 不直接连模型。用户可见结论必须带 `sourceLabel`。

4. **DEMO/FALLBACK 必须明示。**  
   样板可以存在，但不能伪装成真实经营建议。

5. **高风险事项必须人工确认。**  
   股权、合同、重大付款、客户承诺、供应商锁定、预付款、违约责任等，不允许一键静默采纳。

6. **前端只做咨询决策引擎。**  
   触碰真实产线资产，例如报价、BOM、交期、真实交付、付款、对外承诺，必须转后端 `jiqun_ai_fresh :8081`，不能在前端自建第二套产线 flow。

---

## 3. 任务总览

| 阶段 | 目标 | 成功定义 |
|---|---|---|
| P0-A | 上书房首屏收口 | 老板 10 秒知道今天最该裁什么 |
| P0-B | 丞相处理与交军机处 | 低风险已办，复杂事项可转会审 |
| P0-C | 合法奏折与裁决 | 奏折字段齐全，裁决可持久化 |
| P0-D | 史馆归档 | 一次决策刷新后不丢，后续可引用 |
| P1-A | 部门电影屏骨架 | 礼部样板抽成可复用 shell |
| P1-B | 锦衣卫/钦天监样板 | 信息分类与趋势研判按职责呈现 |
| P2 | 质量门禁 | E2E、sourceLabel、风险门、性能和发布检查 |

---

## 4. P0 任务卡：真实裁决闭环

### Task CT-P0-01：上书房首屏信息收口

**Description:**  
把上书房调整为老板每日决策入口：中央只突出 1 份当前圣旨/奏折，今日预案控制在 3-5 件，其余事项进入丞相左栏。侧栏只显示标题、部门、紧急程度、丞相状态，不展示长正文。

**Acceptance criteria:**
- [ ] 中央区域只承载当前奏折/圣旨正文，不再被顶部多栏和重复说明挤占。
- [ ] 今日预案为 3-5 件；待处理入口总数不超过 8 个。
- [ ] 每条预案显示 `sourceLabel`、紧急原因、影响范围、建议动作。

**Verification:**
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm build`
- [ ] 浏览器检查 `http://localhost:3002/chaotang/court-briefing`
- [ ] 截图确认首屏 10 秒内能看懂一号事项。

**Dependencies:** None  
**Files likely touched:**
- `src/app/**/court-briefing/**`
- `src/features/**/briefing/**`
- 现有 briefing API adapter

**Estimated scope:** M

---

### Task CT-P0-02：丞相状态与减负逻辑

**Description:**  
给每条事项明确丞相状态：`丞相汇报`、`丞相已办`、`待补证`、`交军机处`。低风险琐事不打扰老板，只汇报处理意见；证据不足的事项默认待补证；复杂事项允许转军机处。

**Acceptance criteria:**
- [ ] 事项标题后显示丞相状态标识。
- [ ] `丞相已办` 可以展开查看处理意见和证据，不默认占中央正文。
- [ ] `待补证` 必须列出 1-3 个最关键证据缺口。
- [ ] `交军机处` 保留原问题、证据、来源、目标部门。

**Verification:**
- [ ] 单元或组件测试覆盖状态渲染。
- [ ] 手动刷新后状态不丢。
- [ ] fallback/demo 状态被明确标识。

**Dependencies:** CT-P0-01  
**Files likely touched:**
- `src/lib/contracts/chancellor-decision.ts`
- `src/app/api/court/**`
- `src/features/**/chancellor/**`

**Estimated scope:** M

---

### Task CT-P0-03：交军机处会审入口

**Description:**  
从上书房/丞相栏点击“交军机处”后，生成或打开一个军机处议题。军机处展示谁参与、各自意见、冲突点、丞相主持实况，以及关联的蜂群/部门。

**Acceptance criteria:**
- [ ] 点击后创建/定位到同一 `taskId`，不产生孤儿议题。
- [ ] 军机处显示参会部门、蜂群、意见摘要、争议点。
- [ ] 页面能区分真实输出、混合输出、fallback 输出。

**Verification:**
- [ ] E2E：从上书房交办到军机处，`taskId` 连续。
- [ ] `pnpm build`
- [ ] 浏览器手动走完整交办链路。

**Dependencies:** CT-P0-02  
**Files likely touched:**
- `src/app/(dashboard)/**/command-center/**`
- `src/app/api/court/**`
- `src/lib/contracts/task.ts`

**Estimated scope:** M

---

### Task CT-P0-04：奏折合法性与展示

**Description:**  
统一奏折结构，缺字段不得作为正式奏折展示或归档。合法奏折必须包含：圣裁、分奏、证据、缺证、风险、后令、质门、来源。

**Acceptance criteria:**
- [ ] 缺任一字段时标为“待补/非法奏折”，不允许静默归档。
- [ ] 中央正文只显示奏折内容，底部显示丞相分析、下一步建议、钦天监分析。
- [ ] sourceLabel 在正文或页脚清楚可见。

**Verification:**
- [ ] 奏折 validator 覆盖完整/缺字段/错误来源三类样本。
- [ ] 页面检查长文不溢出，不遮挡裁决按钮。
- [ ] `pnpm exec tsc --noEmit && pnpm build`

**Dependencies:** CT-P0-03  
**Files likely touched:**
- `src/lib/contracts/memorial.ts`
- `src/lib/contracts/decree.ts`
- `src/features/**/memorial/**`
- `src/app/**/court-briefing/**`

**Estimated scope:** M

---

### Task CT-P0-05：老板裁决动作持久化

**Description:**  
裁决按钮统一为：采纳、补证、复核、驳回、追问。所有动作写入任务状态和决策记录。刷新页面后不丢。高风险动作进入人工确认门。

**Acceptance criteria:**
- [ ] 五种裁决动作都有明确状态变更。
- [ ] 刷新页面后仍能看到裁决结果和下一步。
- [ ] 高风险动作触发 `governance gate`，不能直接静默采纳。
- [ ] 失败时保留任务，并提示可重试，不丢用户输入。

**Verification:**
- [ ] E2E 覆盖至少采纳、补证、高风险确认三条路径。
- [ ] 数据库或持久化层能读回同一 `taskId`。
- [ ] `pnpm build`

**Dependencies:** CT-P0-04  
**Files likely touched:**
- `src/features/governance/lib/gate.ts`
- `src/lib/db/primary-store.ts`
- `src/app/api/court/**decision**`
- `src/lib/contracts/task.ts`

**Estimated scope:** M

---

### Task CT-P0-06：史馆归档与旧案引用

**Description:**  
正式裁决后写入史馆，保存问题、奏折、证据、风险、裁决动作、sourceLabel 和复盘字段。后续相似问题可以看到“历史镜鉴”提示。

**Acceptance criteria:**
- [ ] 每次正式裁决生成一条归档记录。
- [ ] 归档页能按 `taskId` 查到本次决策。
- [ ] 上书房后续 briefing 可引用旧案，并说明相同点/不同点。

**Verification:**
- [ ] E2E：裁决 -> 史馆查回 -> 返回上书房引用。
- [ ] `pnpm exec tsc --noEmit && pnpm build`
- [ ] 手动刷新验证记录不丢。

**Dependencies:** CT-P0-05  
**Files likely touched:**
- `src/lib/contracts/archive.ts`
- `src/lib/db/primary-store.ts`
- `src/app/(dashboard)/**/archive/**`
- `src/app/api/court/**archive**`

**Estimated scope:** M

---

## 5. P0 Checkpoint

完成 CT-P0-01 到 CT-P0-06 后，必须做一次老板视角验收：

- [ ] 老板进入上书房，10 秒知道今日一号事项。
- [ ] 老板 3 分钟读完一份奏折。
- [ ] 老板能选择采纳/补证/复核/驳回/追问。
- [ ] 高风险事项出现人工确认门。
- [ ] 史馆能查回本次决策。
- [ ] 页面明确标识 LIVE/MIXED/FALLBACK/DEMO。

通过后再扩更多部门页。

---

## 6. P1 任务卡：部门电影屏工作台

### Task CT-P1-01：抽取 CinematicDepartmentShell

**Description:**  
以礼部当前样板为基础，抽取可复用的部门电影屏骨架：两侧贴边面板、中间深度大屏、最多 8 个入口、点击入口后在中屏展示详情。

**Acceptance criteria:**
- [ ] Shell 不绑定礼部文案和礼部图片。
- [ ] 支持部门背景、人物、入口列表、中央内容区。
- [ ] 移动端不重叠，入口可滚动或折叠。

**Verification:**
- [ ] 礼部迁移后视觉不退化。
- [ ] Playwright 截图桌面/移动端。
- [ ] `pnpm build`

**Dependencies:** P0 Checkpoint 或礼部样板确认  
**Files likely touched:**
- `src/features/**/components/CinematicDepartmentShell.tsx`
- `src/app/(dashboard)/manor-dept/[deptCode]/libu-client.tsx`

**Estimated scope:** M

---

### Task CT-P1-02：锦衣卫信息分类样板

**Description:**  
锦衣卫不是风险堆叠页，而是信息分类和核验分流页。按政策法规、市场竞情、供应交付、客户信号、待核验、转派部门组织。

**Acceptance criteria:**
- [ ] 信息按类别、可信度、来源、建议转派部门展示。
- [ ] 单来源信息默认进入“待核验”，不直接进入结论。
- [ ] 点击类别后中屏显示详情和下一步。

**Verification:**
- [ ] 浏览器截图确认信息分类清晰。
- [ ] `pnpm build`

**Dependencies:** CT-P1-01  
**Files likely touched:**
- `src/app/(dashboard)/manor-dept/[deptCode]/jinyiwei-client.tsx`
- shared shell

**Estimated scope:** S-M

---

### Task CT-P1-03：钦天监趋势研判样板

**Description:**  
钦天监关注全球及国家大趋势、风险机会、连锁反应和对公司各部门的影响。每条趋势必须有时间窗、触发信号、影响部门、预案动作。

**Acceptance criteria:**
- [ ] 每条趋势显示时间窗、触发信号、影响范围、建议预案。
- [ ] 区分“事实信号”和“趋势推断”。
- [ ] 可把重大趋势转交军机处会审。

**Verification:**
- [ ] 浏览器截图确认中屏可读。
- [ ] `pnpm build`

**Dependencies:** CT-P1-01  
**Files likely touched:**
- `src/app/(dashboard)/manor-dept/[deptCode]/forecast/page.tsx`
- shared shell

**Estimated scope:** S-M

---

### Task CT-P1-04：六部职责内容收口

**Description:**  
每个部门首页先回答“本司负责什么、不负责什么、今天老板该看什么”。每页入口不超过 8 个，不再用“老板关注四个字”做标题。

**Acceptance criteria:**
- [ ] 户部：现金安全、预算、ROI、融资、审计。
- [ ] 兵部：竞争行动、资源调度、项目攻防、应急预案。
- [ ] 工部：交付、质量、产能、阻塞、验收。
- [ ] 刑部：合同权益、制度内控、法规趋势、突发事件。
- [ ] 礼部：营销、宣传、企业文化、公关、审美门禁。
- [ ] 吏部：关键岗位、组织负载、招聘补位、继任备份。

**Verification:**
- [ ] 每页首屏入口数量 <= 8。
- [ ] 文案职责不混淆。
- [ ] `pnpm build`

**Dependencies:** CT-P1-01  
**Files likely touched:**
- 各部门 client/page 文件

**Estimated scope:** M，建议分部门逐个做

---

## 7. P2 质量门禁

### Task CT-P2-01：核心 E2E 覆盖

**Description:**  
补齐上书房、军机处、裁决、史馆四段主链路 E2E。E2E 可 mock 后端三态，但不能用 mock 证明真实 agent 已可用。

**Acceptance criteria:**
- [ ] 上书房首屏渲染。
- [ ] 交军机处保留 `taskId`。
- [ ] 裁决刷新后不丢。
- [ ] fallback/demo 明示。

**Verification:**
- [ ] `pnpm exec playwright test`
- [ ] `pnpm build`

**Dependencies:** P0 tasks  
**Estimated scope:** M

---

### Task CT-P2-02：发布前 sourceLabel 审计

**Description:**  
检查所有用户可见 AI 结论是否带来源标识。任何 DEMO/FALLBACK 文案不得伪装 LIVE。

**Acceptance criteria:**
- [ ] 页面结论区有 sourceLabel。
- [ ] API fallback 响应可被 UI 识别。
- [ ] 截图中可看见来源状态。

**Verification:**
- [ ] `rg "sourceLabel|sourceMode|FALLBACK|DEMO|LIVE" src`
- [ ] 浏览器抽查关键页面。
- [ ] `pnpm build`

**Dependencies:** P0 tasks  
**Estimated scope:** S

---

## 8. 不做清单

- 不在 P0 前继续铺完所有部门页。
- 不用静态文案冒充真实经营建议。
- 不在 UI 组件里直接调用模型。
- 不在前端仓修改后端蜂群真实运行逻辑。
- 不把报价、BOM、交期、付款、客户承诺等产线资产留在前端咨询引擎里处理。
- 不新增第二套 memorial/task/source 类型。

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 页面继续扩散，闭环没跑通 | 高 | P0 Checkpoint 前暂停新部门大扩展 |
| fallback 被误认为真实结果 | 高 | sourceLabel 强制显示，E2E 覆盖 |
| 裁决没有持久化 | 高 | CT-P0-05 单独成任务，刷新验收 |
| 奏折字段不齐但进入归档 | 高 | CT-P0-04 validator 闸门 |
| 高风险事项静默采纳 | 高 | governance gate 必须接入 |
| 礼部样板抽 shell 过早 | 中 | 先让礼部视觉过一次人工验收，再抽象 |
| 前后端职责混乱 | 中 | 触碰真实产线资产即转后端 jiqun |

---

## 10. Open Questions

1. 第一条真实验收用例是否仍选“厦门 AI 公司合作评估”？
2. 今日预案排序权重：紧急度、金额影响、法律风险、老板偏好，哪个优先？
3. 丞相已办事项是否只日报汇总，还是允许老板逐条追认？
4. 史馆旧案引用第一版做关键词匹配即可，还是需要向量检索？
5. PM workflow 生成的 PRD 是否也进入史馆，作为产品决策旧案？

---

## 11. 建议执行顺序

第一批只做：

1. CT-P0-01：上书房首屏信息收口。
2. CT-P0-02：丞相状态与减负逻辑。
3. CT-P0-05 的最小骨架：至少让裁决动作刷新不丢。

原因：这三件事最接近老板每天打开系统的真实体验，也最能暴露当前数据、状态、持久化的短板。

等这三件过一次浏览器验收，再接 CT-P0-03/04/06，把军机处和史馆接完整。
