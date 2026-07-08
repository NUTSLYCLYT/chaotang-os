# 吏部 · 下一阶段计划(2026-06-22 沉淀)

> 本程已交付,见 work 分支 `a7dc7d7 / 49354fe / a0ee5cc / 2d9d338`。
> 主设计 SoT 见 `LIBU_DESIGN.md`(招聘把关一根脊)、`LIBU_BACKLOG.md`(HR/行政诚实占位)。
> 本文件只列**下一阶段**该做的,带优先级、依赖、阻塞与并发对齐要求。

## 进度更新(2026-06-23)
下方原计划的 P2/P0/P1 **均已落地**(work 分支 `f38e80b / 9f81b90 / c95d542`):
- **P2 把握度精度** ✅ `f38e80b`:蜂群未返质量分时显「未测」转灰,不以帝金冒充真把握度。
- **P0 chrome 礼让** ✅ `9f81b90`:经逐部门浏览器验证,改为结构默认——**7 个被遮部门**(finance/legal/ops/physician/guard/gongbu/works/personnel)关 rail,**礼部(market/libu)保留**(client 不占边缘)、通用 ManorDeptClient 保留(需 ambient)。原"待并发对齐"已落地;rail 本体未删,再动先对齐。
- **P1 dogfood + 缺口可读化** ✅ `c95d542`:跑 3 个真实场景(好/含糊/矛盾)——**结论:脊会区分**(好→准奏93%/含糊→缓/矛盾→缓·return_rework),**不是橡皮图章**;但 dogfood 抓到真缺陷:裁断句"缺口"漏技术内容(check 内部码 / QA 解析错误原文)→ 已修可读化(码→人话、滤技术噪声、干净兜底、reject 清空缺口)。

**仍开放**:
- **P1 真闭环(真老板信号)**:dogfood 是代理,验证了 verdict "够硬+可读";唯一未答的判据是**真老板会不会不点证据就采纳**。需安排一次真老板使用,只记一个数:他点没点"证据"折叠。这是真·单向门。
- **动作层(采纳/补证/驳回)**:仍门控真老板信号(别给未被真人验证采纳的脊加配件)。注意:采纳→史馆归档涉及持久化与可能的共享主表(铁律4 双门),且真发 offer/定薪必须转后端(§13.2#9),落地前先定持久化边界。
- **seed 组织盘点退场到底**:仍阻塞后端(无真 org 数据源)。现降级「沙盘示意」保持。

## 已交付(本程)
- 招聘真链脊:BFF 点火+轮询(`/api/court/dept/li-bu/recruit[/result]`)、验真承重墙、诚实闸纯函数 `recruit-envelope.ts`。
- **裁断句主角**:`recruit-verdict.ts`(QA门→准奏/缓奏/不准)+ 回归断言;`LiveRecruitPanel` 渲染 verdict 单句 + 把握度徽,字段下沉为证据。
- **版面手术**:招聘真链卡进右栏主角、seed 组织盘点降级「沙盘示意」横幅。
- **chrome 占位修**:`departments/[code]` 对 personnel 传 `suppressRails` 关掉遮挡真链卡的静态 OFFICE RAIL。
- 全部经铁律4 双门(独立会审 + 回归断言)+ 浏览器验收。

---

## P0 · chrome 结构性礼让真 client(已批准 · 但阻塞在并发对齐)
**目标**:把"该部门有真 client 就不渲染装饰 rail"做成**结构默认**,替代现在 personnel-only 的 `suppressRails` 临时招(2d9d338)。一条规则守所有部门,不逐处打地鼠。

**关键发现(动手前必读)**:`departments/[code]/page.tsx` 的 `VALID_CODES` 里**每一个部门都已有专用真 client**(Hubu/Xingbu/Libu/Bingbu/Taiyi/Jinyiwei/Gongbu/Personnel),`ManorDeptClient` 兜底分支对 valid code 永不触发。⇒ "有真 client 就让位" = **OFFICE RAIL 在所有部门都该消失**,`ThreeAxisOfficeRails` 实质成废装饰。

**为何阻塞、不能单方面做**:OFFICE RAIL 是并发线近期(8-12h)刚建的**共享 chrome**(`ThreeAxisOfficeRails` / `DepartmentUniversalScroll` / `DepartmentStudyFrame` / `DepartmentAgentCorners`)。把它从所有部门拆掉是 chrome **存废级决定**,属并发地盘(铁律§13.2#10)。**先对齐 chrome owner**:这套 rail 还要不要?要留就留给谁(无真 client 的将来场景?)、SSOT 放哪。对齐后再写。

**落地建议(对齐后,最小改动)**:在 `page.tsx` 建 `DEPTS_WITH_REAL_CLIENT` 单一真相集,`DepartmentWorkflowBoundary` 内 `suppressRails = DEPTS_WITH_REAL_CLIENT.has(code)` 自动派生,删掉 personnel 的 per-call prop。不深改 `ThreeAxisOfficeRails` 本体(最小化与 chrome owner 的合并冲突)。
**完成判据**:逐部门浏览器截图——真 client 部门 rail 不再遮边缘列。

## P1 · 拿到裁断句的「唯一验证判据」信号(最高杠杆 · 单向门 · 门控动作层)
**目标**:设计 SoT 钉死的唯一判据——**老板看完裁断句,需不需要每次点开证据才敢动?会不会因把握度低而追问?** 这要真使用观察,代码验不了。
**为何最先**:这是全阶段唯一真·单向门;没这信号,动作层与扩枝都是赌。**P0 等并发对齐的空档正好拿来并行做这条**——找一次真招聘场景让老板用一次裁断句,看他点了几次"证据"。
**完成判据**:一次真实使用记录/老板反馈,判定脊立没立住。

## P2 · 把握度精度诚实补丁(小 · 孤立 · 可随时做)
**问题**(上轮会审 MEDIUM):蜂群未返 `quality_score` 时 `RecruitVerdict.confidence` 默认 0.5,仍以帝金 LIVE_SWARM 徽出镜,误导"蜂群有 50% 把握"。
**改**:`recruit-verdict.ts` 加 `confidenceSource: 'measured' | 'default'`;`confidence-source-badge.tsx` 对 `default` 不显伪百分比(显「未测」/转灰);`live-recruit-panel.tsx` 透传。只动这 3 文件 + nodetest,**不碰 chrome、无需对齐**。

---

## 暂不做(标清依赖,防空转飞轮 · 铁律5)
- **动作层 + 高风险人工确认门**(采纳/补证/驳回 + gate.ts L0-L4):门控在 **P1**——脊验住了再做,否则给没立住的脊加配件,过早决策。
- **seed 组织盘点退场到底**(升 turso 或彻底撤下):**阻塞在后端**——无真组织数据源(`LIBU_BACKLOG` 标 [不建])。现已降级「沙盘示意」,保持,别再建;等后端有真 org 数据再升真。

---

## 排序
1. **P1**(并行,不排队)+ **P0 对齐**(并发沟通)——同时启动。
2. P0 实现(对齐通过后)。
3. P2(随手,任意时点)。
4. 动作层(等 P1 信号)/ seed 退场(等后端)——现在别碰。

## 并发提示
chrome(rail/卷轴/StudyFrame)是共享且并发线活跃改动的文件;本程 `2d9d338` 是当前 personnel-only 状态。任何 chrome 改动提交首行标 `[shared]`,合并前与并发线对齐。
