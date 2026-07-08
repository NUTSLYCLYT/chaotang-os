# 钦天监 · 自我进化闭环 — 解冻卡（THAW CARD）

> **什么时候打开我**：当你手上更重要的事告一段落、决定真正让「钦天监·预测自动证伪」这个部门跑起来时。
> 打开这张卡 → 从「阶段0」直接开工，不用重新推导（2026-07-04 已想清楚，别再绕一天）。
> **一句话现状**：逻辑就绪、测绿、休眠；真瓶颈是「上游 0 条真预测记录」+「方向识别正则判反」，不是 UI。

---

## 已有产出（休眠态，tsc 绿 / 8 测全绿，未接线、未提交）

| 文件 | 内容 |
|---|---|
| `src/features/qintian/lib/price-forecast.ts` | 任务5 核心 `citedSourcesContradict()` / `contradictingSignal()`（引用来源冒反向信号→证伪） |
| `src/lib/department-learning/qintian-signal-tracking.ts` | `effectiveVerdict()`（任务5+6：自动 refuted / 过期 stale，返回 `{verdict, reason}`）+ `EFFECTIVE_VERDICT_CN` |
| `src/lib/jinyiwei/qintian-citation-audit.ts` | 任务7 `auditQintianCitations()`（锦衣卫反查：引用的信号还在不在） |
| `src/features/qintian/lib/qintian-auto-verdict.nodetest.ts` | 8 条回归断言（`npx tsx --test <file>`） |

**这些是纯函数、渲染时可调用；解冻后大概率不删，但要按下面路线接对地方。**

## 两个真瓶颈（真数据实测确认，非猜测）

1. **上游 0 条记录**：`/api/court/learning/records` 真实返回 0 条钦天监预测。下游三函数无数据可判 → 现在接 UI = 空转。**这是第一阻塞。**
2. **正则判反**：`price-forecast.ts` 的 `UP_RE/DOWN_RE` 在真 12 条 intel 语料上把「隔膜过剩降价」「储能价创新低跌破」判成涨；覆盖不了「转弱/承压/创新低」。**方向识别不可靠 → 证伪会反向误判（把跌当涨、冤枉证伪）。**
   附加脆弱点：来源匹配是 `sources[0].name` **精确字符串相等**，现实同来源写法不一（"SMM" vs "上海有色网SMM"）会漏触发。

## 落地路线（四阶段，每阶段独立可验、可停）

| 阶段 | 做什么 | 验收（真数据） |
|---|---|---|
| **0 · 产第一条** ⭐ | 钦天监 agent(LLM, `callLLM`)针对一个真话题产**一条**预测：方向+理由+**引用真锦衣卫信号id**+证伪条件，落一条 `observing` 记录。方向由 **LLM 判**（顺带绕开坏正则） | 真跑一次，看 LLM 方向对不对、引用信号真不真 → **记录 0→1，解锁一切** |
| **1 · 正则退休** | 方向 LLM 判、落 `direction` 字段；证伪读字段不跑正则；来源用信号 id 不用 raw name | 之前正则判反的 3 条，LLM 判对没 |
| **2 · 证伪建议+确认门** | 信号刷新→批量检查 observing 预测→有反转的生成「建议证伪」（不直接改库）→推用户一键确认→落 refuted（满足铁律13.2.5 高风险人工门） | 造一次同来源反转，看建议弹出、确认后进飞轮 |
| **3 · 展示+飞轮** | 周报/钦天监页展示 observing/refuted/stale+命中率；任务6(过期,纯日期)在这层顺带接 | 一眼看懂、命中率真回填 |

**接入点已探明**：`src/features/shared/components/department-flywheel-recap.tsx` 已同时持有 records + intelSignals，阶段3 接这里。

## 解冻时先拍两个决策（30秒）

1. **引擎边界**：钦天监预测=咨询决策(不碰报价/付款/产线资产)，按铁律13.2.9 **可走前端咨询引擎**(建议)；但落学习记录写共享库属高危，阶段1 带独立会审+回归断言(铁律4)。→ 前端 or 后端jiqun？
2. **自动 vs 确认**：建议**渐进信任**——先"自动检测+人工一键确认"（满足"不等人发现"：检测是自动的），命中率证明够准后再放开全自动。→ 认渐进 or 一步到位全自动？

## 探针（想先验真数据再动手就跑这俩）

- `dev/handoffs/qintian-frozen-probes/probe4-llm-direction.ts` — LLM判方向 vs 正则(真12信号并排),复现正则**判反**
- `dev/handoffs/qintian-frozen-probes/probe5-real-signal.ts` — **端到端真链**：一条真 SMM 信号→LLM 产预测(方向/引用/证伪),正则在此判反
- 跑法：`set -a; source .env.local; set +a; npx --yes tsx dev/handoffs/qintian-frozen-probes/probe5-real-signal.ts`（需 prod :3050 活；只读、不写库；用 OPENAI_* 调 LiteLLM:4444）
- （早期 probe2/probe3 用正则版,已被 probe4/5 取代,未入库；结论已并入上文"阶段0-a/全链验证"两节）

## 解冻第一步命令

> 「解冻钦天监，按 THAW-CARD 阶段0 开工」——我读这张卡，拍完上面两决策，从产第一条真预测开始。

## 阶段0-a 已跑（2026-07-04 · LLM判方向验收）

探针 `probe4-llm-direction.ts`（直连 OPENAI_*=LiteLLM :4444, swarm-strong）。结论：
- ✅ **LLM 判方向 >> 正则,阶段1 赌注验证通过**：真实措辞下正则 10/12 判 unclear（无涨跌字面词就废）；LLM 能产结构完整的预测（方向+真id引用+具体 falsifiedBy）。→ 值得做「正则退休、LLM判方向落 `direction` 字段」。
- 🧱 **更深的真瓶颈（优先级高于判决逻辑）**：intel 信号源目前是 **demo/种子、会变**（17:00 是电池域 `sig-xxx`，18:30 变成宏观域 `signal_001..012`：AI Act/美联储/稀土），且**域不匹配**（拿宏观信号预测"碳酸锂"）。**要让钦天监真起来，先得有稳定的、电池域相关的真情报馈送** —— 这是 `/api/court/intel/signals` 数据源的事。
- ⚠️ 架构错配（顺带发现）：前端 `src/lib/llm/router.ts` 的 `callLLM` 只读 `LITELLM_*`，但环境只提供 `OPENAI_*` → 前端 callLLM 当前会掉 template 兜底。阶段0b 用前端引擎产预测前，要么修 router 读 `OPENAI_*`，要么走后端 jiqun。

**解冻后修正的阶段顺序**：阶段0.5「先落实稳定的电池域真情报源」→ 原阶段0（产第一条真预测,方向用LLM）→ 原阶段1/2/3。别跳过0.5,否则给一个 demo 信号源接判决=又空转。

### 阶段0 全链·真信号验证（2026-07-04 · probe5-real-signal.ts）
用一条**真实** SMM 情报（中矿锂业临时停产检修，2026-07-01，真URL `news.smm.cn/news/103982413`）喂全链：
- ① 正则判 **down**（命中"停产"→需求跌）→ **判反**：供应端停产实为利多涨。
- ② LLM 判 **up**（正确区分供应/需求端）；③ 全链产出完整预测：up/medium/**引用真id**/5条具体 falsifiedBy。
- **结论**：真数据上 LLM 决定性胜正则，正则不是不完美是**危险**（会让自动证伪反向触发）。阶段1「正则退休、LLM判方向」= 已被真数据坐实,必做。

### intel 信号源现状（侦察确认）
- `/api/court/intel/signals`：GET 读真 Turso `intel_signals` 表；**表当前为空** → 走 `mockIntelSignals` fixture，`meta.source='fallback'`（诚实标注）。
- **真情报管道已建好**：POST `/api/court/intel/signals`（需 session）带**锦衣卫 source-gate**（`assertLiveSourcesHaveUrls`：LIVE 必须真URL），经 `upsertIntelSignalFromFinancialCollection` 落库。
- **所以阶段0.5 缺的不是基建，是"生产者"**：一个往这个 POST 口喂真电池情报（带真源URL、过gate）的采集器 —— 接锦衣卫真采集（记忆:采情牒 Phase1 `chaotang-intel/ops`，户部电芯价采集器待建）。probe5 那条 SMM 信号就是现成的第一条真料。

---
_冻结于 2026-07-04（周六冻结日）。代码休眠未提交。这张卡在，就不会错过。_
