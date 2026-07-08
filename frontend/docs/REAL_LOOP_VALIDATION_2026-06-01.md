# 第一条真闭环 · 实证记录（2026-06-01）

> 窗口 A 实证：用真 DeepSeek + app 真实 prompt，跑通"厦门AI合作评估"真决策。
> 结论：**北极星核心假设 H3（真 agent 出真有用输出）已验证。** 配套 [NORTHSTAR_REAL_LOOP_V1_PRD.md](./NORTHSTAR_REAL_LOOP_V1_PRD.md)。

---

## 1. 实证结果（非 mock，真实生成）

| 验证 | 方式 | 结果 |
|---|---|---|
| 单丞相奏折 | `/api/chat` 的 SYSTEM_PROMPT × DeepSeek | ✅ 产出结构化奏折：总批+4维度+90天时间线+大臣分派，言之有物 |
| 3 视角参审 council | 户部/刑部/礼部 prompt 并行 × DeepSeek | ✅ 三视角各有侧重、含具体数字/法条/话术，非占位 |
| 成本 | 一次 council 总 token≈621 | **≈¥0.0012/次**（DeepSeek，可忽略） |
| 格式兼容 | DeepSeek `/chat/completions` stream | ✅ 与 `openaiStream` 的 `"content"` delta 完全一致 |

**判定**：H3「真 agent 产出真有用经营分析」**成立**。H4「闭环可跑通」在 substance 层成立，剩端到端 UI 串联（Codex RL-01/02）。

---

## 2. 验证过的参审 Prompt（Codex RL-01 直接 copy）

> 这些已实测产出高质量差异化输出。Codex 实现 `/api/court/chaotang/council` 时直接用，省去调 prompt 的反复。

```ts
// 决策文本作为 user message；以下为各视角 system prompt
export const COUNCIL_PERSPECTIVES = {
  hubu:  '你是户部尚书,只从财务视角评估。输出:①预计投入区间 ②ROI测算(乐观/中性/保守) ③回收期 ④现金流风险。每条一句,带数字假设。不超150字。',
  xingbu:'你是刑部尚书,只从法律与股权视角评估。输出:①股权结构红线 ②尽调必查项 ③合规/监管风险 ④建议的股权保护条款。每条一句。不超150字。',
  libu:  '你是礼部尚书,只从招商与对外定位视角评估。输出:①一句话对外定位 ②核心招商话术3条 ③可能的舆情风险 ④对外材料清单。每条一句。不超150字。',
};
// 汇总：把 3 段交给丞相 SYSTEM_PROMPT(已在 /api/chat) 做总批 → 一份奏折
```

实测样例（厦门AI）：户部给出"投入1200-2000万/ROI 150·75·40%/回收2.5-4.5年/缺口400万"；刑部给出"创始≥67%控制权/反稀释尽调/网安法数据法/回购+僵局条款"；礼部给出"自贸区定位/3条话术/舆情风险/材料清单"。

---

## 3. 实现配方（RL-01，已极度去风险）

```text
1. cp /api/chat/route.ts 的 openaiStream + directStream + toStream（生产级,已验证）
2. 新建 /api/court/chaotang/council/route.ts：
   - 收 { decision: string }
   - 并行 3 个 openaiStream(COUNCIL_PERSPECTIVES[x] + decision)
   - 收齐后 → 丞相 SYSTEM_PROMPT 汇总 → 一份奏折
   - env 已就位：OPENAI_API_KEY=DeepSeek / OPENAI_BASE_URL=api.deepseek.com/v1
3. 前端军机处 BattleStream 接这个 SSE
```
环境变量已写入 `.env.local`（gitignore，不入库）。**需一次受控 dev 重启加载。**

---

## 4. 验收（AC5）仍需的唯一动作

> substance 已证。**最后一步只能老板做**：受控重启 dev → 登录 → 在军机处/丞相处把"厦门AI"决策跑一次 → 读真奏折 → 说出"这帮我了/这个我能用"。

```bash
! pnpm dev   # 加载新 env；访问 localhost:3002/chaotang/... 找丞相
```

剩余风险：CourtOS 外部后端真实度（影响 manor/analyze 等代理路由，但 /api/chat 与 council 自包含，绕开它）。

---

> 一句话：**真 agent 已能为真决策出真有用的奏折，且几乎零成本。朝堂 OS 跨过了"demo→产品"最关键的技术门槛。剩下的是把它接到 UI，和让老板亲自用一次。**
