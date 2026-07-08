# 北极星 · 第一条真闭环 PRD v1（军机处 · 真决策执行）

> 出品：窗口 A · Claude Opus 4.8 · 工部产品总设计 / 产品御史
> 上位：[PRODUCT_ASSESSMENT_2026-06-01.md](./PRODUCT_ASSESSMENT_2026-06-01.md) · [CHAOTANG_DELIVERY_HARNESS.md](./CHAOTANG_DELIVERY_HARNESS.md)
> 唯一目标（North Star，已与老板确认）：**让 1 个真实老板，用朝堂 OS 真做成 1 件经营决策，并愿意说"这帮我了"。**
> 一句话范围：把**军机处**从"演示 SSE"改成"真模型出真奏折"，跑通一条端到端真链路。**不建新部门、不铺页面。**

---

## 1. 为什么是军机处（而非户部/工部）

| 判据 | 结论 |
|---|---|
| 命门 H3/H4 在哪 | "decision→真 agent 干活→真输出" **只在军机处发生** |
| 谁最接近真 | 军机处已有 BattleStream/SSE/dispatch-policy/task-status，mock 最少 |
| 入口是否就绪 | 上书房 `studyBriefing` 真 API + 信号→`commandDraft`→军机处链路已通 |
| 真模型是否就位 | DeepSeek/Claude/Codex 后端已接，可直接喂军机处 |

**户部/刑部/礼部 = 本闭环里军机处召唤的"参审 agent 视角"，不是要先建的页面。**

---

## 2. 锚定真实决策（演示用例）

**厦门 AI 公司合作评估**（来自 operating-loop daily-brief，decision_needed / 高）。
- 真实问题：合作结构、投入边界、股权风险、招商话术、90 天交付路径需要统一判断。
- 为什么选它：是老板**真实在裁的事**，产出（一份能用的评估奏折）能直接被验证"帮没帮上"。

---

## 3. v1 真闭环范围（薄垂直切片）

```text
[上书房] 看到"厦门AI合作"信号 ──下旨──▶ [军机处] 接旨
                                            │
                          召唤 3 个参审 agent（真模型 · 真输入）
                          ├ 户部视角：商业模式 / ROI / 投入边界
                          ├ 刑部视角：股权结构 / 法律风险
                          └ 礼部视角：招商话术 / 对外定位
                                            │
                          汇总 ──▶ 一份真·评估奏折（结构化、可读、可裁）
                                            │
[上书房/军机处] 老板读奏折 ──▶ [史馆] 归档 ──▶ 次日上书房建议
```

**In scope（必须做真）**：
1. 上书房"厦门AI"信号 → 一键下旨到军机处（链路已有，确认通）。
2. 军机处收到决策 → 调**真模型**（≥1 个，优先 DeepSeek/Claude）跑 **3 个参审视角** on 真实输入。
3. 流式展示真推理（BattleStream 接真 token，不是假动画）。
4. 汇总成**一份真奏折**：商业模式 / 股权风险 / 招商话术 / 90天路径，结构化可读。
5. 老板可读、可裁（采纳/打回）→ 史馆存一条真记录。

**Out of scope（明确砍掉）**：
- ❌ 不建兵部/礼部/太医院页面（礼部只作 agent 视角，无页面）。
- ❌ 不做多决策/批量；只跑这 1 个用例跑透。
- ❌ 不做权限/多租户/登录强化。
- ❌ 不动视觉系统、不铺待建路由。

---

## 4. "这帮我了"的可演示定义（验收即北极星）

> 验收不是"build 通过"，是**老板看完真奏折说出"这帮我了"**。拆成可判定标准：

| # | 验收标准 | 判定方式 |
|---|---|---|
| AC1 | 老板从上书房一句话/一点，**没碰代码**就发起厦门AI评估 | 现场点，录屏 |
| AC2 | 军机处输出由**真模型**生成（同输入两次跑结果有别，非写死） | 改输入→输出变 |
| AC3 | 奏折含 4 块且**言之有物**（不是占位文案）：商业模式/股权风险/招商话术/90天 | 老板读后认可"有用" |
| AC4 | 全程**可现场演示**，端到端 ≤ 3 分钟出结果 | 计时录屏 |
| AC5 | 老板愿意说一句"这帮我了 / 这个我能用" | **唯一真验收**——老板原话 |
| AC6 | 史馆留下这次决策的真记录，次日上书房能引用 | 看归档 + 次日建议 |

**AC5 是唯一的成败判据。** 其余都是为它服务。

---

## 5. 命门技术决策（必须先定，否则全是空）

> H3 的核心：**"军机处的真 agent 在哪儿跑、调谁？"** 这是 v1 第一个要拍的板。三选一：

| 方案 | 路径 | 优 | 劣 |
|---|---|---|---|
| **A. Next.js API route 直调** | `/api/chaotang/council` → DeepSeek/Claude API | 最快、可控、在本仓内闭环 | 编排逻辑要自己写 |
| B. 经 OpenClaw/Hermes | 前端 → 已搭的 agent gateway | 复用多智能体设施 | 跨进程、调试复杂 |
| C. 复用现有后端 | 若 `/api/chaotang/*` 后端已能编排 | 改动最小 | 需确认后端真实度（未知） |

**PM 建议：A**（Next.js API route 直调 DeepSeek，3 个视角 = 3 个 prompt 并行）。理由：本仓内闭环、最快拿到 AC5、不依赖外部进程。**Codex B/架构窗口先确认后端现状，否则默认走 A。**

---

## 6. 任务卡 Backlog

```yaml
- id: RL-00-exec-path-decision   # 阻塞全局，先拍
  title: 定军机处真 agent 执行路径（§5 三选一）
  status: tech_plan  priority: P0  owner: 架构/Codex B + Claude A 评审
  做: 确认 /api/chaotang/* 后端真实度；定方案A/B/C；产出接口契约
  acceptance: [给出可调用的 council 接口定义, 单视角能返回真模型输出]

- id: RL-01-council-api
  title: 三视角参审 API（户部/刑部/礼部 prompt × 真模型）
  status: idea  priority: P0  owner: Codex B
  做: POST 决策文本 → 并行 3 个 prompt(DeepSeek) → 结构化返回
  acceptance: [3视角真输出, 改输入输出变(AC2), 错误兜底]

- id: RL-02-memorial-synthesis
  title: 汇总成真奏折（4 块结构化）
  status: idea  priority: P0  owner: Claude A 定结构 → Codex B 实现
  做: 3视角→商业模式/股权风险/招商话术/90天 一份奏折
  acceptance: [4块齐, 言之有物非占位(AC3)]

- id: RL-03-battlestream-real
  title: BattleStream 接真流式 token
  status: idea  priority: P1  owner: Codex B
  做: 把假动画换成真 SSE/stream 推送参审进度
  acceptance: [流式可见真推理, ≤3分钟出结果(AC4)]

- id: RL-04-shiguan-record
  title: 史馆记一条真决策 + 次日上书房引用
  status: idea  priority: P1  owner: Codex B
  做: 决策结果落归档 → daily-brief 次日能引用
  acceptance: [归档可见, 次日建议引用本次(AC6)]
```

顺序：**RL-00（拍执行路径）→ RL-01 → RL-02 →（AC5 演示验收）→ RL-03 → RL-04**。
> RL-01+RL-02 跑通即可做第一次"帮我了"验收，RL-03/04 是体验增强。

---

## 7. 风险

| 风险 | 缓解 |
|---|---|
| 后端真实度未知 → 卡 RL-00 | 默认走方案 A（Next API 直调），不等外部 |
| 真模型输出质量不稳 | Claude A 调 3 视角 prompt 模板，给少量 few-shot；输出走 zod 校验结构 |
| 又滑回"加页面" | 本 PRD 已砍死 out-of-scope；任何新部门页本周拒绝 |
| 演示翻车 | 先内部跑通+录屏，再给真老板；AC1-4 是 AC5 的前置闸 |
| 与并发窗口撞文件 | RL 卡集中在 command-center/** + 新 api route，避开 gongbu/hubu |

---

## 8. 一句话

> 把军机处这一个节点从"演示"做成"真的"，用厦门AI这一个真决策跑通一次，让老板说一句"这帮我了"。
> **这一句话成立的那天，朝堂 OS 就从最酷的 demo，迈进了 2026 最佳产品的门槛。**

---

## 9. 调查更新（2026-06-01 · RL-00 已基本解开 · 路径大幅缩短）

窗口 A 实地调查 `src/app/api/**` 后定论：

**真 LLM 基础设施已存在且为生产级。** `src/app/api/chat/route.ts` 已实现完整 SSE 流式 + 多 provider（Claude/OpenAI 兼容/scripted 兜底）+ 鉴权 + 限流 + 代理绕过（`directStream`）。`openaiStream` 支持 `OPENAI_BASE_URL`。

**架构事实**：
- `NEXT_PUBLIC_API_MODE=real`（前端已真实模式）。
- 多数 `/api/court/chaotang/*`、`/api/manor/*` 代理到外部 `COURTOS_API_URL` 后端，**挂则 fallback mock**（CourtOS 后端真实度仍未知 = 剩余风险）。
- 但 `/api/chat` **自包含、不依赖 CourtOS**，只差一个 LLM key。

**已执行的最小杠杆**：
- ✅ `.env.local` 写入 `OPENAI_API_KEY=<DeepSeek>` / `OPENAI_BASE_URL=https://api.deepseek.com/v1` / `OPENAI_MODEL=deepseek-chat`（DeepSeek OpenAI 兼容）。
- ✅ 实测 DeepSeek 流式格式与 `openaiStream` 完全兼容（`"content":"…"` delta）。
- ⏸ **未重启 dev server**（端口纪律：3002 可能他人在用）→ 需一次受控重启才生效。

**因此 RL 路径缩短为**：
```text
最快"帮我了"（≈0 代码）：重启 dev → /api/chat 丞相用真 DeepSeek 回答厦门AI决策 → 老板读真奏折
进阶（Codex RL-01/02）：克隆 /api/chat 的 openaiStream → 新建 /api/court/chaotang/council
                         3 个并行 prompt(户部/刑部/礼部) → 汇总真奏折
```

**RL-00 结论**：执行路径 = **方案 A（Next API 直调，已验证）**，不必等 CourtOS。RL-01 从"造轮子"降级为"克隆 chat route 改 prompt"。

> 下一步最高价值动作：受控重启一个 dev 实例（owner 操作）→ 用 /api/chat 跑一次厦门AI真问答 → 这就是第一个可验收的"帮我了"候选。
