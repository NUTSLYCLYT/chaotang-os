# 主线 A 闭环真实度审计 v1 — 上书房金融闭环（2026-07-19）

只读审计。目标：逐环节标注 真实 / 降级 / 假数据 三态，找出「上线内测」前
必须补的缺口。审计对象为源码直读（分支 `docs/absorption-ledger-20260718`
基于本地 ext 79b1eaa），未运行浏览器 E2E。

## 链条真实度表

| # | 环节 | 三态 | 证据（file:line） | 说明 |
| --- | --- | --- | --- | --- |
| 1 | 前端指令解析 + canonical API 调用 | 真实 | `frontend/src/features/shangshufang/ShangshufangPage.tsx:3256` | P14 已复审：唯一调用点、路径测试锁定、REAL build 通过 |
| 2 | 鉴权 + 立案持久化 | 真实 | `backend/web/routers/shangshufang.py:1953-2085` | CurrentUser/tenant、`create_decision_task` + `CourtReview` 真写库、session JSON 原子落盘（`:658`） |
| 3 | 锦衣卫取证 | **假数据** | `backend/src/finance_intel_loop_contract.py:139-148,243` | **零网络请求**。URL 是模板拼接：CIK 硬编码仅 AAPL/MSFT 两只；URL 从未验证可达；却标 `status: completed`、`quality_score: 0.9`、`official_sec_sources_present: true`（`:375-383`） |
| 4 | 户部核算 | 降级-诚实 | `finance_intel_loop_contract.py:106-136` | `compute_finance_metrics` 缺定量输入拒算（`computed=False`，不编数）——诚实。但主线前端只传 ticker/market/question，**永远缺输入 → 永远不算**。奏折 summary 是固定文案，无任何个股实质分析 |
| 5 | 质量门 | 半真 | `finance_intel_loop_contract.py:298-309` | 检查逻辑真执行，但检查对象是拼出来的 URL；`quality_score` 全链为编造常量（0.9/0.92/0.88/0.86） |
| 6 | 裁决/执行/归档状态机 | 状态机真、动作空 | `finance_intel_loop_contract.py:320-350` | 状态推进逻辑真实且写库可回放（`/api/swarm/sessions/{id}`）；但 `internal_watchlist_candidate_created` 只是字符串，无 watchlist 实体落库 |
| 7 | source_label | **违规（HIGH）** | `finance_intel_loop_contract.py:471`；`shangshufang.py:2078` | session 级硬编码 `"LIVE_SWARM"`，router memorial_json 同样硬编码——**与本仓「诚实标」纪律直接冲突**。顶层 LIVE/FALLBACK 判定依据是「URL 拼出来没有」，不是「真取证没有」 |
| 8 | 红线/合规层 | 真实（超预期） | `shangshufang.py:1983-1987,2034-2037`；contract `:266-291` | `forbidden_outputs`（禁交易/支付/外部承诺）、`nonAdviceDisclaimer`、`executionAllowed: False`、`manualConfirmationRequired: True` 已成体系——台账 #1「户部红线」**部分已在 ext**，吸收量比预估小 |
| 9 | 前端渲染 | 真实 | P14 复审记录 | REAL 模式 build 通过 |

## 结论一句话

**壳真、芯假：API/鉴权/持久化/状态机/红线全真，唯独「情报」本身——取证和
核算——是模板。** 用户拿到的奏折结构完整、合规完整，但不含任何真实获取的
SEC 数据。working-backwards 句子（"五分钟拿到带 SEC 官方来源、来源可点开
验证的风险奏折"）当前不成立：来源仅 2 只票可拼出、未验证可达、无实质分析。

## 已有资产（补缺口不需要从零写）

| 资产 | 位置 | 状态 |
| --- | --- | --- |
| 锦衣卫真实检索（Tavily） | `backend/src/jinyiwei_search.py` | 已写好、缺 key 诚实退空；**未接进 finance-intel-loop** |
| ddgs MCP 检索 | `backend/mcp_servers/ddgs_server.py` | 存在（ddg/Jina 已接通） |
| SEC EDGAR 公开 API | `data.sec.gov`（免 key，只需 User-Agent） | companyfacts/submissions 模板 URL 已在 contract 中，差一步真 GET |
| 户部核算引擎 | `compute_finance_metrics` | 逻辑现成，只缺真实输入喂进去 |
| 台账 #4 pack_rd 确定性锚 | UNVERIFIED-REMOTE | 核实后可作反作弊层 |

## 缺口与整改包（按序）

| 包 | 缺口 | 内容 | 量级 |
| --- | --- | --- | --- |
| PKT-A1 锦衣卫真取证 | G1 零请求 / G2 两只票 / G4 假标 | EDGAR companyfacts 真 GET + 可达性验证；CIK 用 SEC `company_tickers.json` 全量表替换硬编码；sourceLabel 改三态诚实标（`VERIFIED_FETCH` / `TEMPLATE_URL` / `FALLBACK`），删除硬编码 `LIVE_SWARM` | 小-中 |
| PKT-A2 户部实算 | G3 永不核算 / G5 编造分 | companyfacts 提取核心财务喂 `compute_finance_metrics`；quality_score 改由真实检查产出 | 中 |
| PKT-A3 事故日夹具 | 无极端回归 | 台账 #3：-2.85% 纳指日重放进黄金样例 | 小 |
| 之后 | — | 内测上线（牌 A：业主 + 2~3 人，本机/内网） | — |

## 排序理由

G4（假标）单独看是 HIGH 诚实违规，但修标签若先于修取证，标签会诚实地全变
FALLBACK——界面上等于"闭环坏了"。所以 A1 把真取证和诚实标**捆一个包**：
取证变真的同时标签变诚实，用户看到的是升级不是降级。

## 审计边界

- 未跑浏览器 E2E、未起后端服务实测 HTTP（源码级审计；PKT-A1 验收时补实跑）。
- 未核实 EDGAR API 当前限流政策（PKT-A1 开工时确认，公开资料为 10 req/s + User-Agent 要求）。
- tests：`test_shangshufang_loop_api.py` 19 个用例覆盖立案/裁决/归档合同，
  `test_finance_intel_loop_contract.py` 覆盖 contract 行为——现有测试**锁的是
  「模板行为」**，A1/A2 改造时这些测试要按新契约更新，属预期变更不是回归。
