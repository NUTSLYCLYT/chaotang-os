# 变更摘要：fix-hubu-fact-card-real-quality-score-20260719

Packet ID: P23

（内部代号 PKT-A2：主线 A 审计整改第二包，修 G3/G5）

| 字段 | 值 |
| --- | --- |
| Change ID | fix-hubu-fact-card-real-quality-score-20260719 |
| 类型 | fix |
| 状态 | IMPLEMENTED_CANDIDATE / EXTERNAL_REVIEW_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：审计 G3（户部奏折无实质数据）/ G5（quality_score 编造常量）整改。
- 文件：`sec_edgar.py`（extract_key_facts + gather 返回 facts）、
  `finance_intel_loop_contract.py`（memorial.factCard + `_qa_score` 推导）、
  两个测试文件扩展、本 change 四件套。
- 验证：受影响 40 tests、全量 suite、NVDA 真网事实卡 smoke、双 doctor。

## 核心变更

1. **事实卡**：companyfacts 200 时解析最新 10-K 年度核心指标（营收/净利/
   总资产/总负债/现金，us-gaap 标签优先链），只取官方申报数字；解析不出即
   缺席，不推算不编造。落 `memorial.factCard`。
2. **真实 quality_score**：`_qa_score` 按质量检查通过率推导（无 checks 按
   pass 布尔），替换全部编造常量（0.9/0.92/0.88/0.86/0.35/0.25）。锦衣卫
   checks 增加 `official_sources_verified`：verified=1.0、模板=0.5、无=0.0。
3. `compute_finance_metrics`（ROI/回收期）语义不变：其输入是项目投资制数据，
   与个股事实卡正交，继续诚实拒算。

## 边界

- 不改前端（factCard 为增量字段）；不改 API 路径/词表；不动 swarm.py 调用方。
- 事实卡只呈现申报数字，不生成估值结论——非投资建议红线不变。
