# 变更摘要：docs-mainline-a-truth-audit-20260719

| 字段 | 值 |
| --- | --- |
| Change ID | docs-mainline-a-truth-audit-20260719 |
| 类型 | docs |
| 状态 | DRAFT / OWNER_APPROVAL_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260719 |

## 范围

- 主线：主线 A（上书房金融闭环）九环节真实度审计，三态标注 + 缺口整改包排序。
- 文件：`truth-audit.md`（审计本体）+ 本 change 四件套。
- 验证：源码直读（file:line 全部可核）、`node scripts/harness-doctor.mjs`。

## 核心结论

- 壳真芯假：API/鉴权/持久化/状态机/红线全真；锦衣卫取证零网络请求（假数据），
  户部核算诚实拒算但主线输入下永不核算（降级）。
- HIGH 诚实违规：`source_label: "LIVE_SWARM"` 两处硬编码
  （`finance_intel_loop_contract.py:471`、`shangshufang.py:2078`）。
- 意外增益：户部红线体系（禁交易/支付/承诺 + 非投资建议 + 人工确认）已在 ext，
  台账 #1 吸收量小于预估。
- 整改排序：PKT-A1（真取证+诚实标捆绑）→ PKT-A2（户部实算）→ PKT-A3（事故日
  夹具）→ 内测上线。

## 边界

- docs-only，只读审计，未改任何实现或测试。
- 未跑浏览器 E2E / 未起服务实测；PKT-A1 验收时补实跑。
