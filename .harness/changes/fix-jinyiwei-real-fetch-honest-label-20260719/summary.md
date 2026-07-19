# 变更摘要：fix-jinyiwei-real-fetch-honest-label-20260719

Packet ID: P22

（内部代号 PKT-A1：主线 A 审计整改第一包；P21 号被 idempotency 包占用，本包顺延 P22）

| 字段 | 值 |
| --- | --- |
| Change ID | fix-jinyiwei-real-fetch-honest-label-20260719 |
| 类型 | fix |
| 状态 | IMPLEMENTED_CANDIDATE / OWNER_DIFF_REVIEW_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：主线 A 审计 G1/G2/G4 整改——锦衣卫真取证 + CIK 全量 + sourceLabel 诚实化，捆绑一包。
- 文件：新增 `backend/src/sec_edgar.py` + 2 个测试文件；修改 `finance_intel_loop_contract.py`、`web/routers/shangshufang.py`、既有 loop API 测试的网络隔离。
- 验证：新测试 9 个 + 全后端 suite（2817 passed）、真网 smoke（NVDA verified=True）、双 doctor 0 errors。

## 核心变更

1. `sec_edgar.py`：SEC 全量 ticker→CIK 表（var 缓存 7 天，拉取失败回退内置两只票）；companyfacts 真实 GET 验证可达；全失败路径诚实降级不编造。
2. contract：`build_finance_intel_session(evidence_fetcher=...)` 注入式取证；诚实标三态（真验证→`LIVE`、用户自带证据→沿用请求标、模板/无证→`FALLBACK`）；删除 `source_label: "LIVE_SWARM"` 硬编码；qualityGate 新增 `official_sources_verified` 检查。
3. router `/complete`：接入真 fetcher；四处标签统一用 session 计算值；`evidence_complete` 门禁升级为必须真验证；timeline 锦衣卫取证只在真验证后标完成。
4. 标签词表未扩展——全部落在既有 `LIVE/FALLBACK` 合同值内，前端合同校验器零改动。

## 边界

- swarm.py 旧调用方不注入 fetcher：行为形态不变，但标签同步诚实化（模板→FALLBACK）。
- quality_score 编造常量不在本包（A2 处理）；户部实算不在本包（A2）。
- 既有失败 `test_core_tenant_lineage_contract` / `test_court_review_writer_inventory` 为基线预存（干净 79b1eaa 同样失败），非本包引入，记录不修。
