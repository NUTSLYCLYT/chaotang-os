# 规格说明：docs-r0-w08-fin-data-audit-20260728

## 背景

用户询问当前仓是否已经具备金融数据源、免费数据源。由于 R0-W08 主线目标仍是产品验收硬化，本次只做只读资产审计和后续接入设计边界，不把金融能力接入 W08 验收范围，也不声明生产可用。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 有本地企业财务导入：Excel/CSV -> fact pack/verified_facts -> number provenance gate | `backend/src/finance_data_parser.py`、`backend/src/finance_facts.py`、`backend/src/hubu_finance_csv_loader.py`、`backend/config/flow_finance.yaml` | 源码只读 | 否 |
| 已确认事实 | 有免费官方 SEC EDGAR 公开源，且当前实现支持 ticker map、companyfacts、submissions、真实 fetch verified 标记 | `backend/src/sec_edgar.py`、`backend/src/finance_intel_loop_contract.py`、`backend/tests/test_finance_intel_loop_honest_label.py` | 源码只读 | 否 |
| 已确认事实 | 有 Polymarket public-search 零 key 查询 helper，失败诚实返回空列表 | `backend/src/polymarket_lookup.py`、`backend/tests/test_polymarket_lookup.py` | 源码只读 | 否 |
| 已确认事实 | 投资/金融输出已有安全闸：不得给买卖、仓位、交易执行建议 | `backend/harness/hubu-investment-swarm-gate/README.md` | 源码只读 | 否 |
| 已确认事实 | 未发现统一 market data provider 层，也未发现 AkShare/yfinance/Tushare/Eastmoney/Alpha Vantage/Finnhub/Polygon/IEX/FRED/CoinGecko/Binance 的已实现 provider | `rg` 检索 `backend/src backend/tests backend/config backend/harness docs .harness` | 源码只读 | 否 |
| 未知问题 | 外部免费源的当前 ToS、频率限制和授权边界未在本 Packet 联网复核 | 不适用 | 后续 FIN-A1 | 是，阻止直接接入 |

## 数据流与调用链

### 企业内部财务数据

金蝶/审计导出或 CSV 模板
-> `finance_data_parser.py` / `hubu_finance_csv_loader.py`
-> `finance_facts.py`
-> `verified_facts`
-> `flow_finance.yaml` 的 number provenance gate
-> 户部分析输出。

性质：本地、只读、可溯源、适合 B2B 企业财务审查和经营分析；不属于公开行情源。

### SEC 公开数据

Ticker
-> `sec_edgar.resolve_cik`
-> SEC `company_tickers.json` 缓存
-> SEC `companyfacts` / `submissions`
-> `gather_sec_evidence`
-> `finance_intel_loop_contract.build_finance_intel_session`
-> memorial factCard / quality gate。

性质：免费公开官方源，适合美国上市公司 filings 与年度核心事实；不是实时行情源。

### Polymarket 公开市场

Query
-> `polymarket_lookup.search_markets`
-> `https://gamma-api.polymarket.com/public-search`
-> event/market odds。

性质：零 key 事件预测市场源；适合宏观/政治/加密事件参照，不是证券报价，不得作为投资建议。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `verified_facts` | 本地财务文件解析与校验 | `flow_finance.yaml` / number provenance gate | 已有 parser、validator 与测试 |
| `sourceUrls` / `financialSources` | SEC EDGAR URL 或用户提供 URL | finance-intel-loop | 已有 tests 覆盖来源保留、缺失来源阻断 |
| `sec_edgar.gather_sec_evidence` | SEC 官方公开 API | finance-intel-loop evidence_fetcher | 已有真实 fetch/降级诚实标测试 |
| `polymarket_lookup.search_markets` | Polymarket public-search | 调用方按空结果降级 | 已有单测覆盖解析、失败、limit |

## 数据源资产清单

| ID | 类型 | 免费/成本 | 当前成熟度 | 可用于 | 不可用于 |
| --- | --- | --- | --- | --- | --- |
| LOCAL_ENTERPRISE_FINANCE | 本地企业财务文件 | 免费，本地用户提供 | 已实现，可测 | 合同/经营/回款/预算证据 | 外部市场实时行情 |
| SEC_EDGAR_COMPANYFACTS | 官方公开 filings | 免费公开，无业务 key；需要合规 User-Agent | 已实现基础 fetch 与缓存 | 美股上市公司公开财务事实 | 实时报价、A 股、港股 |
| POLYMARKET_PUBLIC_SEARCH | 预测市场公开搜索 | 零 key；ToS 待复核 | helper 已实现 | 事件概率参考 | 证券行情、交易建议 |
| USER_SUPPLIED_URLS | 用户提供证据 URL | 取决于来源 | 已有来源保留逻辑 | 补证与审计线索 | 未验证时不得标 LIVE |
| FAKE_JIQUN_FINANCE_LOOP | 测试 harness | 本地测试 | 仅测试 | browser/API smoke | 真实金融数据证明 |

## 免费候选源

这些是后续设计候选，未在本 Packet 联网确认最新 ToS，不能直接进入生产或 W08 验收声明。

| 候选 | 价值 | 初步风险 | 建议 |
| --- | --- | --- | --- |
| SEC EDGAR | 官方、免费、低信任风险 | 美国上市公司 filings，不是行情 | 作为第一优先继续完善 |
| FRED | 宏观经济数据 | API key/限流/条款需复核 | 适合宏观辅助证据 |
| World Bank / OECD | 宏观与国家指标 | 更新频率和指标口径需标明 | 适合背景事实 |
| Stooq | 免费 EOD 行情候选 | 授权、稳定性、覆盖需复核 | 只可先做 prototype |
| Yahoo/yfinance | 易用、覆盖广 | 非官方、稳定性和授权风险 | 不作为生产可信源默认项 |
| AkShare | A 股等多源封装 | 上游来源复杂、反爬/授权风险 | 只做隔离调研 |
| 东方财富 | A 股数据丰富 | 网页/接口授权和反爬风险 | 需法务/安全复核 |
| CoinGecko | 加密资产行情 | 免费 tier 限流、条款需复核 | 若做 crypto 再评估 |

## 范围

- 只读审计当前仓已有金融/财务数据能力。
- 给出免费数据源候选和合规边界。
- 给出后续 provider 层建议。
- 不接入新 API。
- 不修改产品运行代码。
- 不改变 W08/W09 排期权威。

## 非目标

- 不做实时行情系统。
- 不做投资建议系统。
- 不做交易、下单、仓位建议。
- 不把 fake jiqun 或本地 smoke 证据包装成真实金融数据。
- 不把外部免费源接入生产。
- 不启动 W09。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 无 verified_facts | 不编企业财务数字，按缺证/未核实处理 | `finance_facts.py`、`flow_finance.yaml` |
| SEC fetch 失败 | `verified=False`，不升级为 LIVE | `sec_edgar.py` |
| 用户提供 URL 但未验证 | 保留来源，但不得当成 verified official source | finance-intel-loop tests |
| Polymarket 查询失败 | 返回 `[]`，调用方降级 | `polymarket_lookup.py` |
| 投资输出试图给买卖/仓位建议 | harness 应拒绝 | `hubu-investment-swarm-gate` |

## 风险与回滚边界

- 风险：免费源条款和限流随时间变化，必须在接入前联网复核官方条款。
- 风险：市场数据容易被误用成投资建议，必须沿用 investment swarm gate。
- 风险：W08 主线是合同审查产品验收，金融 provider 过早接入会导致任务漂移。
- 回滚：删除本 change 目录即可，不影响产品代码。

## 计划确认记录

- 批准人：用户口头 “继续”
- 批准日期：20260728
- 批准范围：金融数据源/免费数据源只读资产审计与后续设计边界
- 明确未批准：产品代码、provider 接入、W09、push、deploy、DB migration、3050

## 验收标准

- 文档明确回答“目前有没有金融数据源和免费数据源”。
- 区分已有能力、测试 harness、候选免费源、缺失 provider。
- 明确金融数据源接入不改变 W08 主线。
- 明确免费源接入前需要 ToS/限流/授权复核。

## 验证计划

- `git diff --check`
- `node scripts/harness-doctor.mjs`
- 源码只读 grep/sed 证据复核
