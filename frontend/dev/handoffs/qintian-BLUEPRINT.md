# 钦天监 · 预测自我进化闭环 — 工程蓝图 v1（教科书级 · 可执行）

> 单一权威方案。整场对话(2026-07-04)的判断/验证/架构/路线收敛于此。
> 配套产物:解冻卡 `qintian-self-evolution-THAW-CARD.md`、探针 `qintian-frozen-probes/`、生产者 `qintian-producer-proto.ts`、上线脚本 `go-live.sh`。

---

## 0. 一句话

让钦天监的**预测**能被**真实情报**自动证伪/校准 —— 形成"决策→真结果→自动学习"的**越用越准飞轮**,而不是又一个仪表盘。

## 1. 第一性定义（要什么 / 不要什么）

- ✅ 要:`真情报 → 预测(带方向+证伪条件) → 新情报自动检验 → 命中率校准` 的闭环。
- ❌ 不要:静态展示、假精确数字、追随 mock 数据的空转飞轮。
- **判据(铁律5)**:任何一步落地前先答"它产出的第一条**真实**数据从哪来"。答不出=空转,冻结。

## 2. 已验证事实（证据链,不重复验证）

| 结论 | 证据 |
|---|---|
| LLM 判方向 **完胜** 正则(正则把供应端"停产"判成跌,危险) | probe4/probe5/producer,真 SMM+新浪+证券时报情报实测,5条纠正3条 |
| intel 源当前 **mock 兜底**(`meta.source='fallback'`),真表空 | GET `/api/court/intel/signals` 侦察 |
| 真情报**管道已建好**(POST + 锦衣卫 `source-gate` 要求 LIVE 带真URL),缺"生产者" | route.ts 侦察 |
| **0 条学习记录** → 下游证伪/校准全空转 | records API 探针 |
| 核心逻辑(证伪/过期/引用体检)**已实现测过** | commit `c27976ab`,25/25 测过、tsc/build 绿 |

## 3. 架构（数据流 + 前后端边界 + 契约）

```
[真情报采集器]                         ← 后端(jiqun):锦衣卫真采集,唯一缺的"生产者"
      │ POST /api/court/intel/signals  ← 交界:锦衣卫 source-gate(LIVE 必须真URL)
      ▼
[intel_signals 表] ──GET──► 前端展示   ← source='turso'(真) / 'fallback'(mock,诚实标注)
      │
      ▼
[钦天监 LLM 产预测] 方向+理由+引用真id+证伪条件   ← 方向由 LLM 判、落 direction 字段(正则退休)
      │
      ▼
[learning record: observing] 写共享库    ← 铁律4 高危:独立会审 + 零污染回归断言
      │
      │ 新情报刷新时自动检验
      ▼
[证伪"建议"] ──人工一键确认──► [refuted 落库]   ← 铁律13.2.5:高风险自动改判过人工门
      │
      ▼
[飞轮:命中率校准] ──► 越用越准,回填史馆
```

**前后端分工**:
- **前端**(chaotang-web-lyt):展示(信号/预测/命中率)、人工确认门 UI、渲染态判决(标注"未落库")。
- **后端**(jiqun):真情报采集、真落库、钦天监 agent 真产预测、飞轮统计。
- **交界契约**:`IntelSignal{id,title,summary,sources[{name,url,sourceType,credibility}],direction}` + `PredictionRecord{id,direction,confidence,citedSignalIds,falsifiedBy,verdict}`。**改契约=铁律4,过会审。**

## 4. 分阶段路线（里程碑式,每阶段独立可验收、可停）

| # | 里程碑 | 谁做 | 入口→出口 | 验收(真数据) |
|---|---|---|---|---|
| **0.5** | 真情报**生产者** | 后端(锦衣卫采集)/前端咨询引擎 | 无真情报 → 真情报入 `intel_signals` | GET `source='turso'` |
| **0** | 第一条真预测 | 前端咨询引擎(callLLM)或后端 | 真情报 → 一条 observing 记录(LLM判向) | 记录 0→1,方向对、引用真 |
| **1** | 正则退休 | 后端+契约(会审) | 正则判向 → LLM 落 `direction` 字段 | 之前判反的真信号 LLM 判对 |
| **2** | 证伪建议+确认门 | 前后端 | 反向信号 → "建议证伪" → 人工确认 → refuted | 造反转,建议弹出、确认进库 |
| **3** | 展示+飞轮 | 前端 | 记录 → 命中率/observing/refuted/stale 展示 | 一眼看懂、命中率真回填 |

## 5. 当前进度（诚实账）

- ✅ **核心逻辑**(证伪`citedSourcesContradict`/过期`effectiveVerdict`/体检`auditQintianCitations`)—— `c27976ab`,休眠、测过。
- ✅ **端到端能力**(真情报→LLM判向→综合预测)—— 生产者原型 `a1b9e77`,真数据跑通。
- ✅ **上线弹药**(5条真情报一键入库)—— `go-live.sh` `f3d2xk9`。
- ✅ **知识固化**(解冻卡+探针+2026-07-18提醒+memory)。
- ⏳ **上线集成**(起 dev+建表+鉴权+POST+验证)—— 待稳定时段,SOP 见 §7,~10 分钟。

## 6. 高效实现方法论（今天血的教训,教科书心法）

1. **最小真链先行**:先跑通"真情报→LLM→真预测"最细一条端到端,再加血肉。别先写完整一端。
2. **验证前置**:动手前先探针验前提(有真数据吗?假设成立吗?)—— 省下写 150 行才发现空转。
3. **里程碑式**:每阶段独立可验收、可停;每步 green 再下一步,不一口气冲到底翻车。
4. **前后端靠契约并行**:先定 JSON 契约,两端不互等。
5. **不可逆动作先 dev 后 prod**:写库先在本地 dev 验证,prod 上线人在场。
6. **对工具输出存疑**:终端会乱码、会审会把休眠代码报成 bug —— 先核实 finding 是不是描述现状,再动手。

## 7. 剩余执行（精确 SOP,照着走,~10 分钟）

```
1. 起 dev(不碰生产:3050):
   nohup pnpm dev > /tmp/dev.log 2>&1 & disown ; sleep 6
   （NODE_ENV≠prod → file:./.chaotang-main-dev.db,首次访问自动建表）
2. 拿 token:浏览器登录朝堂 → F12 → Application → Cookies → courtos.access_token
3. 填进 go-live.sh 的 TOKEN=，bash dev/handoffs/qintian-frozen-probes/go-live.sh
4. 看到 "source":"turso" = 全链点亮;再跑生产者产第一条真预测
```
每步验证 green 再下一步;dev 环境可删可重建,零不可逆风险。上 prod 前先确认 `TURSO_DB_URL` + 过铁律4 会审。

## 8. 风险与防护（教科书对照表）

| 风险 | 防护 |
|---|---|
| 写库不可逆 | 先 dev 验证,prod 人在场;dev 可删重建 |
| 正则判方向反(供应端停产判成跌) | 阶段1 LLM 落 `direction` 字段,正则退休;接线前**别用判反正则驱动自动改判** |
| 自动证伪冤枉好预测 | 只"建议",过人工一键确认才落 refuted(铁律13.2.5) |
| 展示态 vs 落库态双真相 | 渲染态判决明确标注"未落库",不给同等视觉权重(铁律4) |
| 写共享库污染 briefing/KPI | 落库配零污染回归断言(铁律4) |
| 捆入他人未完成活 | 文件级分拣,只提交本功能线(铁律13.2.10) |

---
_v1 · 2026-07-04 · 核心已实现验证,上线弹药已备,发射待稳定 10 分钟。_
