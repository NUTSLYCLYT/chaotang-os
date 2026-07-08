# 朝堂前端 UI 总策划（11 部门 · 卷宗×现代）

> 定稿 2026-07-01。把今天设计的全部内容落成可交付前端的 UI 策划。**机器面 court_doc 在本后端仓产出;
> 这份策划 + 各部门 UI 文档交给前端仓 `chaotang-web-lyt` 实现人类面（CSS/组件/E2E)。**
> 渲染契约见 [../dept_design/frontend_handoff.md](../dept_design/frontend_handoff.md);文书契约见 `schemas/court_doc.json`。

## 一、设计系统（全院统一）

- **基调**:卷宗×现代 —— 古典骨(楷体标题/官印/案号/骑缝朱印)+ 现代肉(红黄绿黑灯/卡片/渐进展开)。
- **一套卷宗组件,换印换色**:所有部门复用同一个 `<CourtDocCard>`(吃 court_doc JSON 渲染),按部门注入官印 + 主色,**不为每部门另写一套卡**。
- **印章品牌系统**:刑部 天平印·朱砂红 / 户部 算盘印·金 / 礼部 礼器印·青 / 兵部 令旗印·赤橙 / 工部 规矩印·钢蓝 / 吏部 印绶印·紫 / 钦天监 星盘印·靛蓝 / 史馆 史笔印·墨 / 锦衣卫 绣春刀印·玄黑暗红 / 御史 獬豸印·黑金 / 丞相 相印·朱紫。
- **人话在前**:一级只给结论(headline)+ 灯 + "为你挡了什么"(shielded);法条/数据/理论一律折叠二级。

## 二、共享组件(11 部门复用)

`<CourtDocCard>`(卷宗骨架)、`<DeptSeal>`(官印)、`<LightBadge>`(四灯)、`<ItemsList>`(Top 条目渐进展开)、
`<ProvenanceFooter>`(接地落款 rag/deterministic/none)、`<PendingStamp>`(gate=pending 半透"需人工"印)、
`<SignedGuard>`(signed=false 禁执行)、`<SealRibbon>`(骑缝封存号)、`<ActionsBar>`、`<DataState>`(空/加载/错误)、`<DemoDataBanner>`。

## 三、渲染铁律(接后端宪法 C6/C8,所有部门必守)

1. `gate=pending` / `grounding=none` / 证据缺失 → **绝不渲染成绿灯/通过**,显式"需人工/待核/待考"。
2. 灯色**照搬后端,不许美化**;丞相主线各部门灯锁死不可编辑(C8)。
3. `signed=false` 的不可逆动作按钮置灰,必须人工签字态才可点。
4. 错误/不确定 → **默认不放行**,绝不 fallback 成绿。

## 四、P0–P3 交互分档(UI 轻重随复杂度)

- **P0 直答**:不出卷宗卡,单气泡答(琐碎/事实)。
- **P1 单参谋**:轻卡(结论 + 一两条),无完整 items/会审。
- **P2 部门蜂群**:完整卷宗卡(灯/items/接地/印/actions)。
- **P3 会审**:卷宗卡 + 签字闸(`<SignoffGate>`)+ 多视角抽屉,不可逆动作锁定。

## 五、11 部门 UI 文档索引

| 部门 | 文档 | 卡型 | 特色组件 |
|---|---|---|---|
| 刑部 | [xingbu.md](xingbu.md) | 判决书 | 红蓝对抗标签、赔率列 |
| 户部 | [hubu.md](hubu.md) | 奏报·三柱 | 数字来源 tooltip、现金跑道条 |
| 礼部 | [libu.md](libu.md) | 策案/话术卡 | 语域 tab、禁忌词高亮 |
| 兵部 | [bingbu.md](bingbu.md) | 战报 | 战情时间线、异议→话术卡 |
| 工部 | [gongbu.md](gongbu.md) | 验收单 | 重算偏差对比表、确定性接地徽章 |
| 吏部 | [libu_personnel.md](libu_personnel.md) | 任免 | 权限矩阵、大神龙虎榜 |
| 钦天监 | [qintianjian.md](qintianjian.md) | 天象策 | 3 必答问题卡、签字闸 |
| 史馆 | [shiguan.md](shiguan.md) | 卷宗 | 证据链时间线、飞轮看板 |
| 锦衣卫 | [jinyiwei.md](jinyiwei.md) | 谍报 | 可信度徽章、异动雷达 |
| 御史 | [yushi.md](yushi.md) | 封驳 | 四灯总判台、放行签字闸 |
| 丞相 | [prime_minister.md](prime_minister.md) | 主线 | 主线时间轴、源灯徽(锁定) |

## 六、待后端补的字段/收口(各部门 agent 暴露的真矛盾)

1. ✅ **礼部 variants**:已给 `schemas/court_doc.json` 的 `items[]` 加可选 `variants:[{tone,text}]`;前端多语域 tab 可用,builder 后续按需填充(未填则降级单版本,不编造)。
2. ✅ **吏部案号**:设计文档已统一为 `LR-`(与 `court_doc_builder._DEPT_ABBR` 一致,不再与礼部 `LB` 撞)。`advisor_protocols` 无独立 personnel profile、drucker 借调态 —— 仍待后端按需补 profile。
3. ✅ **actions 命名**:已在 `DEPT_REGISTRY` 给每部门登记专属 `actions`(工部 `run_release_gate`、御史 `release/block_escalate`、史馆 `trace_evidence/feed_flywheel/export_amulet`、丞相 `confirm_start/reorder` 等),`build_court_doc` 默认用之 —— **前端不再维护别名表**。
4. ⬜ **户部最大亏损**:无独立硬字段(靠 risks/forecast 拼)→ 缺则显"需补数据",不填假精确值。
5. ⬜ **丞相富字段**:`assemble_mainline` item 目前是 `{level, title, evidence_ref}`,owner/route/due/blocker 是目标形态 → 前端按字段到位渐进渲染。

> 这 5 条是"前端要么降级、要么后端补字段"的接缝,**别让前端编造数据填坑**(那正是各部门要拦的幻觉)。
