# 朝堂 · OpenClaw + Hermes 执行总路线图（一切已安排）

> 2026-06-24 收敛。本文是**总索引 + 有序执行计划**：把 4 份专题文档、5 大神玩法、上线 blocker、修复盘点串成一条按序推进的线。
> **核心战略（5 大神一致）**：杠杆在「记」(Hermes 记忆复利) 不在「做」(OpenClaw 重执行)。朝堂从"每次从零判案的咨询机" → "一本越办越厚、只属于这个老板的私人判例库"。**顺序绝不能反：先 ship 主闭环，再补反写飞轮，OpenClaw 等需求拉动。**

---

## 0. 现状 · 最高优先（非代码，挡在所有之前）
| # | 事 | owner | 状态 |
|---|---|---|---|
| ⓐ | 开 gitee PR → 合 master（feat=court-surfaces-real-business） | 你（gh 开不了 gitee，给 token 或自己点） | **未做·头号 blocker** |
| ⓑ | 运维设 `FENGQUN_AUTH=true` + `JIQUN_VERIFY_PATH` + `NEXT_PUBLIC_API_MODE=real` | 运维 | 未做 |
| ⓒ | 合后 `prod:rebuild` 复活服务（3050 现 DOWN）+ 伪造 token 实测 401/503 | 运维 | 未做 |
| ⓓ | 轮换泄漏的 Hermes `API_SERVER_KEY` | ✅ 已做（2026-06-24） | 完成 |

> **这三件（ⓐⓑⓒ）不闭环，后面所有 stage 都是空谈。** 主闭环不上线=没有真实 run=反写飞轮没东西可写。

---

## 1. 五阶段路线图（stage × 玩法 × owner × gate）
| Stage | 做什么 | 对应大神玩法 | owner | 进入 gate（前置） |
|---|---|---|---|---|
| **0 立即·零代码** | 吃满 Hermes 记忆层（已织进 jiqun 每次 run）；铺三护栏（源标诚实/灰态监控/史馆可引用）；起 :8644 仅验活不接 | — | 后端/运维 | 无 |
| **1 主闭环上线·最高优先** | 完成 §0 ⓐⓑⓒ；落前端诚实化（adapter 工厂闸✅已做 / assertLiveSwarmTrace / 删 mock 假数据 / 数据源徽标 / token fail-closed） | — | 你+运维+前端 | §0 完成 |
| **2 反写线先行** | **玩法1（10x）史馆归档隐形反写**：用户裁决=采纳落库时，把"圣裁+证据+缺证补全+用户实际怎么改"按问题指纹反写进 Hermes（只写不读、不接 OpenClaw、不加 UI）。回归断言：仅采纳态反写、驳回/生成态零写入 | 张小龙+Karpathy | 前端+后端 | **Stage 1 跑出真实 run** |
| **2.5 召回读路径** | **玩法2（10x）拟旨前 kNN 判例召回**：召回 top-3 原始判罚轨迹（userAction/rejectReason/ministrySignals）拼 few-shot 喂丞相，标 MIXED；playbook-updater 降为展示层 | Karpathy | 前端+后端 | **Stage 2 攒到第一批"归档→兑现"数据** |
| **3 需求拉动接 OpenClaw** | 出现真实"重资产/long-running 深办"需求后：配 6 个 `OPENCLAW_*_URL`、做超时隔离+partial+续传、接 Stage 2 反写线、前端 ROLLOUT_STAGE→3 解锁 openclaw 工厂槽；**玩法3（校准战绩当 source-label）+ 玩法4（旧案先声感知层）** | 后端+前端 | **真实产线决策排队 + 反写线就绪** |
| **4 可选·会诊网关 + 蒸馏** | jiqun 建 HermesClient（Bearer `API_SERVER_KEY`→:8644）；hermes-expert 转真 RPC；**玩法5（记忆内循环·范式蒸馏，睡觉时也增值）**；hybrid_retrieval 语义检索根治召回精度 | 后端+前端 | Stage 3 稳定 + 会诊差异化诉求 |

---

## 2. 贯穿红线（每个 stage 都守）+ 大神的「克制三条」
**红线**：① 前端 adapter→jiqun:8081→后端代理，**禁前端直连 :18789/:8644**（铁律13.2-9，gated 工厂已堵）；② **source-label 诚实**，真 trace 才 LIVE_SWARM，反写只写"用户认过的账"非"AI 说过的话"；③ 真实产线资产**必过人工确认门**；④ SSOT 枚举单表禁平行（铁律2）。

**克制三条（5 大神）**：
1. **别接 OpenClaw**——飞轮转出第一条真复利数据前，接它只是每天烧钱的线性成本。
2. **别把召回/校准做成自动门**——历史 90% 采纳率也不能静默自采；校准只降注意力税、**永不给机器夺权**（第一次黑天鹅会用一个被自动采纳的错误报价教你做人）。
3. **别在反写前先做召回、别新增版面**——没监督信号就反写=把模型偏见当祖训越攒越自信地错。

---

## 3. 文档地图（详情看这 4 份）
| 文档 | 答什么 |
|---|---|
| `openclaw-hermes-integration-plan.md` | **怎么接**（Path A/B、adapter 范式、后端 env、真实 file:line） |
| `openclaw-hermes-usage-design.md` | **怎么用得好**（记忆飞轮·分层闸·诚实标源 + 8 维度优缺点 + 5 阶段 rollout） |
| `openclaw-hermes-fix-triage.md` | **所有问题/bug/冲突分诊**（现在可解 ~7 项 / 三个 CRITICAL 是设计态别碰 / 跨仓项） |
| `openclaw-hermes-runtime-map.md` | **端口分配 + 数据归属 + 关键位置**（防端口冲突/数据混乱） |
| 本文 ROADMAP | **总索引 + 有序执行计划**（stage × 玩法 × owner × gate） |

---

## 4. 反直觉总结（贴墙上）
> 最高杠杆**不是**接 OpenClaw 那台威武挖掘机，是给免费 Hermes **补一个字节的方向**——把飞轮从 memory→execution 单向掉成双向。威武的东西是负债（增成本/界面/红线/人工门）；真正的资产是那条**没人盯着看的反写缺口**。护城河的唯一诚实度量不是"存了多少案"，是**"每个案子是否让下一个同类案子更便宜"**（范式命中率/校准率）。
>
> **今天补一个字节（反写），三个月后对手追不上。** 但今天的今天——**先把主闭环推上公网**（§0 ⓐⓑⓒ）。
