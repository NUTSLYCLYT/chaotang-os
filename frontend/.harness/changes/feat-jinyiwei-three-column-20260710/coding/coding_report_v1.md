# 实现报告 v1

## 改动

- 左栏新增真实采证输入，POST `/api/intel/brief` 并处理统一 envelope。
- 左栏展示数据来源状态及后端检索、确定性核验、裁决和真值台账归档能力。
- 右栏新增后端 court_doc 回奏视图，展示 sourceLabel、总判、核验条目、硬门、归档编号和逐条证据。
- 保留中栏产业板/地图及右栏已有来源详情，移除未接线按钮和 FALLBACK 派发入口。
- 中栏默认切换为密报卷轴；产业、地图、队列降为辅助视图。
- 拆出 EvidenceRail、BriefScroll、VerdictRail、SourceStatus、CapabilityList、BriefItem、NextRoute、AuxViews 与真实采证 hook。
- 完成手机“采证→卷轴→处置→状态→辅助视图”、平板中栏优先和桌面三栏布局。

## 取舍

- 主库不可用时仍保留 fallback 浏览能力，但所有指标和文案明确标注兜底。
- 不新增前端 BFF，不复制后端可信度算法。

## 验证

- TypeScript、4 条前端契约测试、生产构建、17 条后端锦衣卫测试与多视口 Playwright 页面核验通过。

