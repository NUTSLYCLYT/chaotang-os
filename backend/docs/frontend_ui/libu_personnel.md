# 吏部 · 前端 UI 策划(任免书 / 责任图 / 权限矩阵 / 大神龙虎榜)

> 定稿 2026-07-01。人类面渲染交付物,落地仓 `chaotang-web-lyt`,本仓只产机器面 `court_doc`。
> 上游契约:`schemas/court_doc.json`(`doc_type=edict`)、`docs/dept_design/libu_personnel.md`(部门设计)、
> `docs/dept_design/frontend_handoff.md`(渲染契约,必读)。
> 基调:**卷宗×现代**。吏部 = 任免 `edict`,官印 **印绶印**,主色 **紫**(官阶/印绶之色)。
> 务实纪律:本文只接**真存在的字段/函数**;尚未落地的(任免书 court_doc、RBAC、责任图)显式标 **[L0 待建]**,不画饼。

---

## ① UI 定位 —— 吏部这张脸回答四个问题

吏部不是考核鞭子,是客户的**责任定心丸**。一屏要让人当场看清:

| 客户脑子里的问题 | UI 怎么一眼答 | 接的真字段 |
|---|---|---|
| **这事出问题找谁?** | 卷宗卡顶部 owner 名牌 + 责任图反向链 | `accountability_map` **[L0 待建]** / `items[].evidence_ref` |
| **这权限给了谁?越权没?** | 角色权限矩阵(谁 × 哪一级自动化),越权格标红 | RBAC 权限位 **[L0 待建]** |
| **这功劳是真做的还是自评刷的?** | 大神/agent 龙虎榜:判官席 vs 观点席 + eval 分 + 判例数 | `persona_registry.roster_summary` / `persona_eval.promotion_gate`(**真已落地**) |
| **能不能让它自动执行?** | 自动化闸:缺人类 owner → `signed=false` 按钮置灰卡死 | `provenance.gate` / `signed`(**契约已定**) |

**一句定位**:吏部 UI = 把"谁负责、给谁权、功是真的、能否自动跑"四件事压成**一张任免书 + 一块龙虎榜**,人话在前,RBAC/eval 细则藏二级。

**这张脸独有的东西**:别的部门只管人,吏部同时管 **agent / 大神 / skill 的任免**——
"谁能下结论"在本仓是代码,不是口号:`can_conclude`(判官席)/ `rag_required`(观点席)落在 `persona_registry`,
`promotion_gate` 决定谁升判官。龙虎榜就是把这套**自指闭环**(吏部管吏部的大神)做成可见产品。

---

## ② 主屏卷宗卡(套 court_doc,机器面字段逐项映射)

ASCII 仅示意布局与字段落点,真实 CSS/组件在前端仓实现。**沿用全院通用卷宗组件,只换印(印绶印)换色(紫)。**

```
┌──────────────────────────────────────────────────────────┐
│ 🪪 吏部 · 任免书            〔紫·印绶印〕  案号 LR-20260701-012 │ ← seal.stamp/color + case_id(楷体)
│ ──────────────────────────────────────────────────────── │
│ 🟡 可任命 · 须先补 1 处                                       │ ← light(黄)+ headline,结论一行在前
│ 吏部为你挡了:无人负责的资金动作自动执行口子                  │ ← shielded(心意①,高亮小字)
│ ──────────────────────────────────────────────────────── │
│ 责任主体     owner：王昭   复核：李珩   审批链：王→李→签字     │ ← accountability_map [L0 待建];无 owner 行整条标红
│ ──────────────────────────────────────────────────────── │
│ 责任与权限 · Top 3                              〔点击展开〕  │ ← items[](按 odds/level 排序,红置顶,RBAC 藏二级)
│  1 🔴 L4 自动报价无人类 owner    高 │ 越权执行/无人追责         │   level=red · odds=高 · impact 右对齐
│      └ 指派人类 owner + approval_path,否则 signed=false      │   fix(折叠态展开)→ evidence_ref 回链
│  2 🟡 reviewer 与 owner 同人(自审)  中 │ 复核形同虚设          │
│      └ 拆分 reviewer 为独立角色                              │
│  3 🟢 drucker 已过 promotion_gate 升判官  - │ 可对绩效下结论    │   绿项 odds="-"
│ ──────────────────────────────────────────────────────── │
│ 落款:drucker · deming · richard-posner · bruce-schneier    │ ← provenance.advisors
│ 接地:法条/规则接地 ✓     御史闸:blocked              ⚠未签字 │ ← grounding + gate=blocked + signed=false 水印
│ ──────────────────────────────────────────────────────── │
│ [指派 owner]  [拆复核]  [升降席]  [存档]                     │ ← actions[](不可逆按钮签字前置灰)
│ 任免待封存 · 史馆 —                          〔骑缝紫印·占位〕 │ ← seal.sealed_archive(签字归档后才出号)
└──────────────────────────────────────────────────────────┘
```

字段映射表(`schemas/court_doc.json` → 视觉):

| court_doc 字段 | 真实取值/枚举 | 渲染落点 |
|---|---|---|
| `doc_type` | `edict` | 标题"任免书" |
| `dept` | `libu_personnel` | 选印章/主色配置 |
| `case_id` | **`LR-`** 前缀(`court_doc_builder._DEPT_ABBR`,见 §冲突提示) | 右上案号 |
| `light` | green/yellow/red/black | 顶部灯 + 整卡边框色 |
| `headline` | str | 一级结论(楷体大字) |
| `shielded` | str / null | 心意①条;null 则整条不渲染 |
| `items[]` | level / title / odds / impact / fix / evidence_ref | Top 列表,红置顶,fix 折叠二级 |
| `actions[]` | `assign_owner` `split_reviewer` `promote_seat` `archive_appointment` | 底部按钮 |
| `provenance.advisors` | 大神名数组 | 落款 |
| `provenance.gate` | passed/blocked/pending/**n/a** | blocked/pending → 盖"需人工复核"半透印,禁绿 |
| `provenance.grounding` | rag / deterministic / **none** | none → 灰条"未接地·需人工" |
| `provenance.rag_grounded` | bool | 接地 ✓/✗ |
| `source_label` | LIVE/LIVE_SWARM/MIXED/FALLBACK/DEMO | 角标(DEMO/FALLBACK 显式弱化) |
| `signed` | bool | false → "未签字"水印 + 不可逆按钮置灰 |
| `seal.{stamp,color,sealed_archive}` | 印绶印 / 紫 / 史馆号 or null | 右上印 + 骑缝印;sealed_archive=null 时印为"占位"灰态 |

---

## ③ 组件清单

### A. 共享卷宗组件(全院通用,吏部复用,**不另写一套**)

- `CourtDocCard` — 吃一份 `court_doc` JSON 渲染整卡(灯/headline/shielded/items/actions/seal)。吏部仅传 `stamp=印绶印, color=紫`。
- `LightBadge` — green/yellow/red/black 四灯 + 边框色。
- `ItemList` — `items[]` 渐进展开,红置顶,`impact` 右对齐,`fix` 折叠二级,`evidence_ref` 回链按钮。
- `SealStamp` — 印章 + 骑缝印;`sealed_archive=null` → 占位灰态。
- `ProvenanceFooter` — advisors / grounding / gate / source_label,负责落实**渲染纪律**(见 ④)。
- `ActionBar` — `actions[]` → 按钮;`signed=false` 时不可逆动作置灰。

### B. 吏部特有组件

**B1. 角色权限矩阵 `RoleMatrix`** —— "谁 × 能自动执行到哪一级"
- 行=角色/人/agent,列=自动化级别 `L0…L5`(L4/L5 = 自动报价/资金动作,协议规定**必须有人类 owner**)。
- 格状态:`granted`(紫实心)/ `none`(空)/ `over`(越权,**红描边**:授了高权但无人类 owner)/ `pending`(待签字,斜纹)。
- 数据来源:RBAC 权限位 **[L0 待建]**;字段建议 `{subject, level, granted_by, approval_path, human_owner}`。
- 交互:点越权格 → 弹"需指派人类 owner"提示,直连 `assign_owner` 动作。

**B2. 大神/agent 龙虎榜 `SeatLeaderboard`** —— 接 `persona_eval` 分席(**真已落地,优先做**)
- 两栏:**判官席(can_conclude)** / **观点席(rag_required,发言强制 RAG)**。
- 每行字段(全部真存在):
  - `name`、`tier`(judge/advisor)— `persona_registry.Persona`
  - `total_bytes` / `file_count` + 进度条对 `JUDGE_MIN_BYTES=50000`(证据厚度=升判官的硬门)
  - eval 分 + 判例数 → `persona_eval.promotion_gate(persona, eval_score, case_count)` 返回 `{promote, reason}`;阈值 `7.5`、判例下限 `3` 直接显示在 tooltip
  - `score_persona` 离线占位时显示 **"needs_gateway · 待网关实打分"**(不能伪造分数)
  - 无判例的大神(`eval_readiness.without_cases`)打 **"无判例·不能升席"** 灰标
- 升降席:点行 → `promote_seat` 动作(**不可逆,需签字**,见 ⑤)。`gate_conclusion` 的 `mode`(judge / advisor_grounded / advisor_view_only)显示为该大神当前"能否下结论"的实时态。
- 铁律提示条:**"只记真实结果,不奖励自评分"**(`merit_record` 协议铁律,任命只学系统改进、不学老板对人的偏好)。

**B3. 责任图 `AccountabilityMap`** —— 反向追责 **[L0 待建]**
- 点任意 item → 反向链:谁拍板 → 谁复核 → 谁签字 → 出事找谁。
- 字段建议 `{owner, reviewer, approval_path[], backup}`;**无 owner 的任务整条标红 + 禁止往下走**(对齐协议"没 owner 不准走")。
- MVP 前可降级为卷宗卡内"责任主体"一行(见 ② ASCII),责任图作为二级抽屉。

**B4. 任免操作 `AppointmentActions`** —— 把 `actions[]` 映射成签字态工作流(见 ⑤)。

---

## ④ 状态规则(接后端宪法 C6/C8,不可放松)

- **灯**:`light` 照搬后端,前端**不得美化**成更乐观(C8);丞相主线里各部门灯原样透传。
- **权责不清 → 红**:无 owner / 权限过大 / 职责冲突 / reviewer=owner 自审 → item `level=red`,卡 `light` 至少 yellow,通常 red。
- **签字态(核心)**:
  - `signed=false` → 全卡"未签字"水印;`promote_seat` / `assign_owner` 等**不可逆动作按钮置灰**,不可点。
  - `signed=true` → 按钮激活;归档后 `seal.sealed_archive` 出史馆号,骑缝印由占位灰转紫实印。
- **gate / grounding 红线**(`ProvenanceFooter` 强制):
  - `gate ∈ {pending, blocked}` → 盖"需人工复核"半透印,**绝不渲染绿灯/通过**(C6 禁假 PASS)。
  - `grounding=none` 或 `rag_grounded=false` → 灰条"未接地·需人工 owner 拍板",观点席结论不得当权威。
- **来源弱化**:`source_label ∈ {DEMO, FALLBACK}` → 角标显式标注,不冒充 LIVE。

---

## ⑤ 交互(复杂度分档 P0–P3,升降席必须签字)

对齐本仓管线复杂度分档:UI 按动作风险给不同确认强度。

| 档 | 动作 | 确认强度 |
|---|---|---|
| **P0** 只读 | 看卡、展开 item、查龙虎榜、查责任图 | 无确认,即点即开 |
| **P1** 轻改 | 折叠/排序、筛选席位、切换 L0–L3 视图 | 无确认 |
| **P2** 留痕改 | `assign_owner`、`split_reviewer`、`archive_appointment` | 二次确认弹窗 + 写 `shiguan` 留痕 |
| **P3** 不可逆 | **`promote_seat`(升降席)**、L4/L5 授权、资金动作授权 | **强制人工签字**:`signed=false` 不可执行;弹窗须展示依据(eval 分/判例数/`promotion_gate.reason`)+ 签字人;提交后才置 `signed=true` 并归档 |

**升降席专属流程**(P3):
1. 点 `SeatLeaderboard` 行 → 弹"升/降席"面板。
2. 面板**强制展示**:当前 tier、`total_bytes` vs 50000、eval 分、`case_count` vs 3、`promotion_gate` 返回的 `reason`(拒绝必带理由)。
3. 不满足 `promote=true` → 升判官按钮直接置灰,只能"补判例/补语料"。
4. 满足 → 需签字人输入 → `signed=true` → `promote_seat` → 自动归档 `shiguan`(带依据 + eval 分 + 签字人)。

---

## ⑥ 空 / 加载 / 错误态

- **空**:
  - 无任免任务 → "尚无任免案 · 提交一句『谁负责这块?』开案"。
  - `items=[]` → "未发现责任/权限隐患 · 绿灯"(仍渲染 headline + 灯)。
  - 龙虎榜 `roster_summary.total=0` → "花名册为空 · 大神语料未入役"。
- **加载**:卷宗卡骨架屏(印章位 + 灯位 + 三行 item 占位);龙虎榜按席位分栏骨架。**禁止**加载态默认显绿灯(避免误读为通过)。
- **错误**:
  - court_doc 拉取失败 → 卡内红条"文书加载失败 · 重试",不留白屏。
  - `score_persona` 返回 `needs_gateway` → **不是错误**,显"待网关实打分"中性态,不报红。
  - 字段缺失(如 `accountability_map` 未就绪)→ 该模块降级为"责任图 [建设中]"占位,不阻塞整卡。

---

## ⑦ 响应式

- **桌面(≥1024)**:卷宗卡 + 右侧龙虎榜双栏;责任图为悬浮抽屉。
- **平板(768–1023)**:单列;龙虎榜折叠为"分席摘要"(判官 N / 观点 M),点开全屏。
- **手机(<768)**:
  - 卷宗卡全宽,`items` 默认全折叠,只露 level 灯 + title。
  - `RoleMatrix` 横向滚动(级别列固定首列角色名)。
  - 印章缩小为右上角标,骑缝印移至卡底单行。
  - P3 签字面板全屏化,依据字段竖排,签字按钮固定底部。

---

## ⑧ 对接 chaotang-web-lyt

- **落地仓**:`/home/ubuntu/workspace/frontend/chaotang-web-lyt`(本仓不写页面/CSS/组件)。
- **数据流**:后端 `court_doc_builder.build_court_doc("libu_personnel", ...)` 产 JSON → 前端 `CourtDocCard` 渲染。吏部已在 `DEPT_REGISTRY` 注册(`edict`/印绶印/紫),印章配置驱动即可,**无需为吏部新写卡组件**。
- **后端就绪度(务实)**:
  - ✅ **真已落地**:`persona_registry`(分席/`gate_conclusion`)、`persona_eval`(`promotion_gate`/`eval_readiness`/`score_persona` 占位)、`court_doc_builder`、`schemas/court_doc.json`、`eval/truth_ledger.jsonl`(`evidence_ref` 回链源,字段 `hash/case_id/verdict/detail/evidence`)。→ **龙虎榜 `SeatLeaderboard` 可立即接真。**
  - 🚧 **[L0 待建]**:吏部任免书的 live `court_doc` 产出、人侧 RBAC 权限位、`accountability_map`、`assign_owner`/`approval_path` 链路、`merit_record` 落地。→ **任免书卡 / 角色矩阵 / 责任图先用 mock court_doc 跑通骨架,后端补薄包装后切真。**
- **建议交付顺序**:① 用刑部已有真 court_doc 跑通 `CourtDocCard` 骨架 → ② 接吏部 `SeatLeaderboard`(真数据已具备)→ ③ 后端补吏部 `build_court_doc` 薄包装出任免书 → ④ RBAC/责任图随后端 MVP 上线再接真。

---

## ⚠ 给后端/设计的两处提示(发现即报,不默改)

1. **案号前缀冲突**:`court_doc_builder._DEPT_ABBR` 里 `libu_personnel="LR"`,而设计文档 `docs/dept_design/libu_personnel.md` §4.1/§4.2 用了 `LB-`(`LB` 已被 **礼部 libu** 占用)。**前端按真实代码用 `LR-`**;建议后端/设计统一口径,避免吏部与礼部案号撞前缀。
2. **`personnel` profile 缺位**:吏部判官席依赖借调 `drucker`(现挂 `finance` profile),`advisor_protocols.yaml` 无独立 `personnel` profile。龙虎榜显示 `drucker` 席位时,数据上是借调态,建议后端新增 `personnel` profile 后前端去掉借调标注。
