# 朝堂 OS · 部门体系 + 蜂群调动汇总（2026-06-24）

> 基于真代码勘察 + 仓内已知现实校正。状态标注按诚实纪律压过一遍——勘察给的 "LIVE" 偏乐观，
> 这里用 `realDataConnected` 真值表 + 部门 client mock 实况兜底，避免"标签冒充接通"。

## 一、部门体系

### A. 主闭环 5 工位（铁律 5 唯一认可的"真用到的版面"）
| 工位 | 路由 | 功能 | 状态 |
|---|---|---|---|
| 上书房 | `/court-briefing`(`/prime`弃) | 拟旨→缺证→派部，写主库 `tasks` | 真闭环 |
| 军机处 | `/command-center` | 会审实时展开/扇出/收束奏折，BattleStream SSE | 真闭环 |
| 史馆 | `/archive`·`/shiguan` | 结案/提炼/归档/回填旧案 | 真 |
| 六部厅 | `/departments` | 七部共识画布，可"下旨"触发 orchestrate | 厅真，各部 client 多 mock |
| 庄园 | `/manors` | 资产台（项目/合同/供应商/财务），存运营态不决策 | 部分真 |

### B. 七部（SSOT = `src/core/courtos/unified/department-registry.ts`，铁律2 三码一表）
| 中文 | swarm码 | prime码 | 路由 | 职能 |
|---|---|---|---|---|
| 户部 | finance | hu_bu | /departments/finance | ROI/成本/现金流/付款/报价依据 |
| 兵部 | war/ops | bing_bu | /departments/ops | 客户意图/成交路径/竞争/GTM/销售分诊 |
| 刑部 | justice | xing_bu | /departments/legal | 合同/股权/付款/承诺/合规/印信/诉讼风险门 |
| 工部 | works | gong_bu | /departments/gongbu | 技术可行/BOM/供应链/交期/验收/交付承诺 |
| 吏部 | personnel | li_bu | /departments/personnel | 归属/审批链/里程碑/跨团队/角色 |
| 礼部 | ritual | li_bu_rites | /departments/market | 品牌/对客话术安全/媒体PR/内容合规 |
| 锦衣卫 | jinyiwei | jin_yi_wei | /intel | 情报核查/证据审计/竞品/舆情/异动雷达（RADAR 纯假待重做） |

### C. 特殊司 / 二级页
大殿 `/overview`(执行仪表盘) · 翰林院 `/hanlin`(炼Skill) · 太医院 `/departments/physician`(健康养生+真链路健康检查，绝不诊断) · 钦天监 `/forecast`(预测) · 冻结：东宫/经营学/demo（铁律5）。

## 二、蜂群调动

### 名册：11 个 Tier-0 agent 码（`src/lib/contracts/agent.ts`，冻结禁增删）
核心2：prime_minister 丞相 · scribe 史官
六部6：li_bu 吏 · hu_bu 户 · li_bu_rites 礼 · bing_bu 兵 · xing_bu 刑 · gong_bu 工
特殊司3：qin_tian_jian 钦天监 · jin_yi_wei 锦衣卫 · tai_yi_yuan 太医院

### 统一 Loop（`runCourtUnifiedDecisionLoop`，咨询态不碰真资产）
拟旨 → 选部(锦衣卫永远第一) → 攒情报 → 派工单 → 会审(绿/黄/红/灰) → 找冲突 → 缺证补证门 → 合奏折(质门+合并sourceLabel)

### 四条入口
| 入口 | 路由 | 进 jiqun? | sourceLabel |
|---|---|---|---|
| 本地咨询 | shangshufang/draft-edict→confirm-edict | 否 | FALLBACK/MIXED |
| 丞相编排 | court/orchestrate（并行+确定性merge） | 否 | LIVE/MIXED |
| 全量会审+质门 | court/decision（router+6部+御史台） | 否 | LIVE/FALLBACK |
| 真蜂群派遣 | orchestrate/sign-off（裁决后） | **是→jiqun:8081 /api/swarm/run** | LIVE_SWARM |

### 前后端边界（铁律13.2.9）
前端 runtime（→callLLM:4444）只做无重资产咨询；碰真实产线资产（PACK/报价/BOM/交期/付款/对外承诺/供应商锁定）必转 jiqun:8081。诚实闸：session 验真可兑现才标 LIVE_SWARM，否则 FALLBACK，绝不冒充真。

### 双保险
- 5 标签（reality-state.ts，worst-wins）：LIVE / LIVE_SWARM / MIXED / FALLBACK / DEMO(禁伪装LIVE)
- 证据 L0–L4（gate.ts，只数 verified 指针）：claim→命令→截图→测试→真数据
- 爆炸半径门：irreversible 需 L3+、external 需 L2+，不足一律 needs_signoff（禁 ?? pass）；高危过人工确认门

## 三、真值表：接真 vs 声称（诚实校正 · 2026-06-24 实测）

### AGENT_META `realDataConnected`（注册表自我声明）
| agent | 声明接真 |
|---|---|
| prime_minister | ✅ true |
| scribe | ✅ true |
| hu_bu 户 | ✅ true |
| li_bu_rites 礼 | ✅ true |
| gong_bu 工 | ✅ true |
| qin_tian_jian 钦天监 | ✅ true |
| jin_yi_wei 锦衣卫 | ✅ true |
| **li_bu 吏** | ❌ false |
| **bing_bu 兵** | ❌ false |
| **xing_bu 刑** | ❌ false |
| **tai_yi_yuan 太医** | ❌ false |
| 计 | **7 真 / 4 假（声明）** |

### 部门 client 实况（每个都"接API + 仍带 mock/seed 兜底"，无一纯真）
| 部门 | mock-标记文件 | 接API文件 |
|---|---|---|
| hubu 户 | 2 | 3 |
| bingbu 兵 | 2 | 2 |
| libu 礼 | 2 | 2 |
| personnel 吏 | 2 | 2 |
| legal 刑 | 3 | 3 |
| gongbu 工 | 0 | 1（薄） |
| intel 锦衣卫 | 2 | 1（RADAR 纯假） |

> 结论：**注册表声明的"接真"与 client 实际渲染的不是一回事**。所有部门 client 仍混着 mock/seed
> 兜底。这正是"漂亮的 sourceLabel/质门 容易让人误以为标了 LIVE 就真接通"的具体证据。

## 四、本会话已修/已知问题（关联）
- 军机处统一 Loop 卡读路径修复（ssf_ 先读本地 SoT，绕 jiqun 旧快照 + 死的 courtos:4000）见 `command-center-loop-readpath` 记忆 + `e2e/shangshufang-readback.spec.ts`。
- 待修：confirm-edict 负载下哑火（C）；ui-to-edict 90秒圣裁卡遮挡（视口 flake，已降级）；courtos:4000 死链对非 ssf_ 仍 5s 超时（B）。
