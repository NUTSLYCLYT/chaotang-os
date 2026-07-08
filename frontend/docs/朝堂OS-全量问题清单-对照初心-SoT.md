# 朝堂OS · 全量问题清单（对照初心 · 前后端）SoT

> 立：2026-06-30 · 基于 5 份 PRD（一页PRD/北极星/PM总PRD/ROADMAP/产品结构）+ 前后端实测审计
> 用途：在"不脱离初心"前提下，把现存所有问题统计全，作为完善的依据。
> 初心锚点（多份一致）：**北极星 = 让 1 个真实老板用朝堂做成 1 件经营决策，并说"这帮我了"（AC5 唯一判据）**；给小老板的横向"包裹式"AI 班子；**从建造→证明**；护城河是诚实。

---

## 0. 总判：当前离北极星(AC5)还差什么

一句话：**骨架全、页面全、诚实层好，但"主闭环没接真智能 + 没有一条真被用记录 + 不能上公网"——三者任一不破，AC5 都无法发生。**

做得好的（守住了初心，别动）：
- ✅ sourceLabel 诚实治理（FALLBACK/DEMO 禁伪装 LIVE）—— PM PRD §11 核心，已落地
- ✅ 人工确认门（高风险不自动采纳）—— P0-06，已有 gate
- ✅ 任务持久化、史馆归档入口、guard 家族齐全（auth/honesty/realdata/tenant/pilot/doctor:comm）

---

## 1. 前端问题（F）

| # | 问题 | 现状证据 | 严重度 | 对照初心 | owner |
|---|---|---|---|---|---|
| **F1** | **主闭环不接真 LLM，恒 FALLBACK** | `draft-edict/route.ts:91` 硬编码 `sourceLabel:'FALLBACK'` + 注释"deliberately does not call live LLM"；`confirm-edict` 的 memorial 也是模板。**但真 LLM 引擎 `executors/llm-executor.ts` 已造好**，只接在 `/api/court/decision`，主链路没接 | **CRITICAL** | 违 P0-03/04/05（真拟旨/真奏折/真来源）；智能化核心缺口 | 前端 |
| **F2** | 三套并行状态机不统一 | `decision-loop.ts`(内核纯函数) vs `LocalDecisionStatus`(上书房手写) vs jiqun task status；主链路没走干净内核机 | HIGH | 违 PM PRD §8.10 主状态模型 | 前端 |
| **F3** | 孤儿能力未通电 | `habit-learner.ts:20`、`UserDecisionProfile`、`hanlin/skill-ledger.ts` 仅测试调用，无落库、不注入 loop | HIGH | 违 P1-04 outcome 反哺、初心"经验复利" | 前端 |
| **F4** | `review_skill` 假执行 | registry `review_skill` 是字符串标签，不接可执行单元；真出意见走 `offices.ts:122 OFFICE_PROFILES` | MEDIUM | agent 能力名存实不接 | 前端 |
| **F5** | 史馆事后兑现(recall-outcome)未喂 | `archive/recall-outcome.ts` 在，但没有"判断→兑现"真实回填 | HIGH | 违 P1-04 + 上线第3门"飞轮快回路" | 前端 |
| **F6** | 已知 UI 卡点 | confirm-edict 90秒圣裁卡遮挡、command-center 统一 Loop 卡（memory 记录，未修） | HIGH | 违 P0-01 上书房10秒知道做什么 | 前端 |
| **F7** | 95 处 TODO/FIXME/待接/占位 | `grep` 前端 src 命中 95 | MEDIUM | 技术债 | 前端 |

> 注：「67 版面多」**不是问题**——初心本期明确"不追求所有部门页完整上线"，白名单挡住是对的克制。别在这上面制造删除或重构。

---

## 2. 后端问题（B · jiqun_ai_fresh）

| # | 问题 | 现状证据 | 严重度 | 对照初心 | owner |
|---|---|---|---|---|---|
| **B1** | **pack_rd 成本流 DAG 断链** | `smoke_readiness.json` pack_rd `status:error`、`total_score:null`；`flow_pack_rd.yaml` 的 `cost_estimator` 未依赖 `bom_synthesizer`，结构上允许"无 BOM 先算成本" | **CRITICAL** | 数字可信 | 后端 |
| **B2** | 过半蜂群未达金标 | 21 蜂群仅 8 个 `total_score≥3.8`；battery_stage_gate≈3.2、sourcing≈3.4 | HIGH | 数字可信 | 后端 |
| **B3** | **几乎无真 LIVE 被用记录** | `department_review_runs` 仅 ~11 行、source_label 全 MIXED，**无一条真 LIVE_SWARM** | **CRITICAL** | 真被用（直接卡 AC5） | 后端 |
| **B4** | 蜂群产出未稳定回流主库 | swarm run 落 reports/session 文件，未稳定写决策主库形成"可复盘被用证据" | HIGH | 真被用 | 后端 |
| **B5** | 总额勾稽无统一强校验 | 后端无"Σ分项==总额 否则标缺证"的断言层，靠各 flow 自觉 | HIGH | 数字可信 | 后端 |
| **B6** | LiteLLM:4444 单点 + 429 频发 | smoke 多蜂群 `rate_limited`（DeepSeek 429），无多 provider 自动切换 | HIGH | 绿是真绿 | 后端/基建 |

---

## 3. 安全 / 发布门问题（S · 对照上线 3 门）

> 一页PRD §4：**C1/C3/飞轮 是硬门，缺一不可公网。**

| # | 问题 | 现状证据 | 严重度 | 门 | owner |
|---|---|---|---|---|---|
| **S1** | **C1 token 验签存疑（alg:none）** | 后端未确证强制校验带 tenantId 的真签名 JWT；前端 `tenant-scope.ts` 仅 decode-only 桩（4 处 readSession/tenantId，不验签） | **CRITICAL** | C1 | 后端为主 |
| **S2** | **C3 租户隔离未数据层默认过滤** | 隔离靠业务层手加条件，非 DAO 层默认注入 tenant_id；6 表加 tenant_id 但默认过滤未闭 | **CRITICAL** | C3 | 前后端 |
| **S3** | **honesty:all exit-code 假绿** | `package.json` honesty:all = `guard:freeze; guard:honesty; test:core`（**`;` 非 `&&`**），前两门红仍可能整体返 0 | **CRITICAL** | 绿是真绿 | 前端 |
| **S4** | **Gitee 不跑 CI** | 仓缺 `.workflow/`，唯一 remote 是 Gitee；`.github/workflows` 在 Gitee 不执行 → CI 拦截是空的 | **CRITICAL** | 绿是真绿 | 前端 |
| **S5** | admin token 长期有效无轮换 | `JIQUN_ADMIN_TOKEN`（253 字符）跨服务复用 | HIGH | C1 | 后端 |
| **S6** | 飞轮快回路未建 | 无"从采纳/推翻数据学起、推翻率下降"的快回路 | HIGH | 第3门 | 前后端 |

---

## 4. 对照 PM PRD P0 需求达成度

| P0 需求 | 达成 | 缺口 |
|---|---|---|
| P0-01 上书房一号入口 | ⚠️ 部分 | 页面有，但 Loop 卡 + 恒 FALLBACK（F1/F6） |
| P0-02 一句话发起 | ✅ | — |
| P0-03 丞相拟旨 | ⚠️ | 模板非真 LLM（F1） |
| P0-04 圣旨结果 | ⚠️ | 模板奏折非真模型（F1） |
| P0-05 来源标识 | ✅ | 做得好，守住诚实 |
| P0-06 人工确认 | ✅ | 有 gate |
| P0-07 任务持久化 | ✅ | — |
| P0-08 史馆归档入口 | ✅ | — |
| P0-09 打回/追问 | ⚠️ 部分 | 状态机不统一（F2） |

**结论**：P0 里"真实智能"那几项（03/04）全卡在 F1（主闭环没接真 LLM）。**F1 是 P0 达成的总开关。**

---

## 5. 优先级：最该先修的（全部直接服务 AC5，按 ROADMAP 信号驱动）

> 纪律：只做直接让"真老板说帮我了"更近的事；其余等信号触发，不空转。

**第一梯队（不破则 AC5 不可能发生）**：
1. **F1 · 主闭环接真 LLM**（拟旨+奏折）→ 产出第一份真奏折。这是 P0-03/04 总开关，也是北极星"军机处真模型出真奏折"的核心。
2. **B1 · pack_rd 成本流修复** → 数字可信，让户部一类真问题能出可信数字。
3. **B3 · 真被用回流 + source_label 真标 LIVE_SWARM** → 攒出"1 个真老板真用"的可复盘记录（AC5 证据本身）。

**第二梯队（要上公网给真用户，必过）**：
4. **S1+S2 · C1 验签 + C3 租户隔离** → 公网硬门。
5. **S3+S4 · honesty:all 改 `&&` + 建 Gitee `.workflow`** → 让"绿"真能拦合并（低成本，半天）。

**第三梯队（护城河，等前两梯队产生真数据后）**：
6. F3/F5 · habit-learner + recall-outcome 通电 → 飞轮/复利。

---

## 6. 不脱离初心的纪律（哪些"看起来该做"其实不该做）

- ❌ **行业可插拔包平台 / 装配层 / 第二个行业包**：我前几轮提的这套是"建造"，**违 ROADMAP 红线"不建新架构来显得在做架构"**，与初心"横向包裹式、不比垂直深、本期不多行业展开"相悖。**已搁置**（见 `docs/朝堂OS-智能化通用化-实施方案-SoT.md`，该文行业包部分标注作废）。PM PRD 里"多行业模板"是 **P2**，不是现在。
- ❌ 建第七个部门 / 铺新页面：违初心。
- ❌ 把 67 版面当问题去删/重构：本期克制是对的。
- ✅ 唯一可加的新依赖：Langfuse（看见 judge/outcome 用），其余 0 新依赖。

---

## 7. 一句话
**问题统计全了，但真正的瓶颈只有一条主线：让一条真闭环（真 LLM 拟旨+奏折 → 可信数字 → 真被用回流）跑通，并能安全上公网给 1 个真老板。** 其余问题要么服务这条线，要么等它产生信号再动。修这条线 = 修向北极星；修别的 = 成本。
