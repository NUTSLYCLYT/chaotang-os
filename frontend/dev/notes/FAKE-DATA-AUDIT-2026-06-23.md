# 部门 client 假数据雷 · 侦察记录（2026-06-23）

> 缘起：太医院旧页整页硬编码 mock（健康总分/体征/诊断）冒充真实，既越医疗边界又踩诚实纪律。
> 怀疑非孤例，扫一遍各部门 client，区分「真链」与「硬编码假数据」。

## 判据
- 真链：调 `chaotang.deptOverview / orchestrate / swarm` 或 `useSWR`，无数据时走诚实空态。
- 假数据雷：纯硬编码 `const ARR = [...]` 当展示数据，无真实来源、无 sourceLabel、无空态。

## 结果

| client | 真链调用 | 硬编码 const | 判定 |
|---|---|---|---|
| 太医院 taiyi | —（已重写为不诊断台） | FIRST_AID/WELLNESS/SELF_LOG（合法参考内容/自录待录） | ✅ 已修(bc87f9d) |
| 户部 hubu | deptOverview + orchestrate | 少 | 真链（卷轴 chrome 已撤 6429b13）|
| **锦衣卫 jinyiwei** | **0** | **RADAR_NODES（情报源流图全假）** | ✅ 已拆(d972705)：合一删 889 行假，导航 guard→真 /intel；intel 兜底诚实补丁(6f52b87) |
| 兵部 bingbu | deptOverview('ops')+orchestrate | BATTLEFIELDS（地图 7 区锚点·静态） | 🟢 清白：真竞品/SWOT/压力指数走真链，BATTLEFIELDS 只是地图脚手架非假指标 |
| 刑部 xingbu | deptOverview('legal')+orchestrate | LEGAL_DAILY_WORK（4 张分类卡·静态） | 🟢 清白：真案件/合规/风险走真链，LEGAL_DAILY_WORK 只是分类标签非假数据 |
| 礼部 libu | —（藏书阁） | 多（书目分类，合法内容） | 真（知识库内容非假数据）|

## 结论（2026-06-23 拆雷完成）
**部门 client 的硬编码假数据雷已全部拆清。** 真正的假数据只有 2 处，均已处理：
1. ✅ 太医院（整页假诊断）→ 重写为不诊断真台(bc87f9d)。
2. ✅ 锦衣卫（RADAR_NODES 假情报）→ 合一删假、导航指真 /intel(d972705) + intel 兜底诚实补丁(6f52b87)。

兵部 BATTLEFIELDS / 刑部 LEGAL_DAILY_WORK 经核为**合法静态脚手架**（地图区域锚点 / 业务分类卡），非假指标——扫描时被「const ARR=[...]」grep 误判。这两页真数据走 deptOverview/orchestrate。

判别经验：硬编码 const ≠ 假数据。要区分「静态 UI 脚手架(地图锚点/分类标签/图标配置)」与「冒充真实业务指标的 mock(体征/评分/情报信号)」——只有后者是雷。

## 方法论纠正（本轮最大收获）
审计用「没接后端的 e2e 截图」当「设计差」证据 → 误判户部/军机处「中部空」。实际：
- 后端 :8081 **在跑且有真数据**（court-session available=true，5191 字真朝报）。
- authed 端点（deptOverview）用 e2e 假 token 被真后端拒 → 显空态，**非没数据**。
- 要看 authed 页真貌须真登录会话。
结论：先修测量（真登录看真数据），再谈美工；硬编码假数据（与后端无关的）才是真该拆的雷。
