# 刑部(法律/合同风险)真链 · 设计方案 + 建设方案

> 2026-06-22 · 由 workflow xingbu-real-chain-design(5 agent:后端架构/高危人工确认门/UI/建设序列/合成)产出。
> flow_legal 已实测金标 quality 4.71、C1/C2/C3 全 PASS;刑部=金标蜂群+最简单(90%照抄吏部)+无产线命门,是最佳下一条真链。
> 照建口令:对一个干净的前端仓说「照刑部方案建」,即可一次建成。

## 1. 定位

**刑部 = 朝堂的法务总顾问真链。** 老板把一份合同条款 / 法律问题丢进去,真启 `flow_legal` 法务合规蜂群,产出一份带"结论先行"的法律会诊意见;其中**触及对外法律立场的后果性条款(核心条款建议 / 法务决策建议)被显式上锁,不可一键采纳,必须过人工确认门**。它是咨询引擎,不是产线引擎——出草案与风险盘点,不替老板对外签约/发函。

---

## 2. 为什么刑部是最佳下一条真链

| 判据 | 刑部满足情况 |
|---|---|
| **金标蜂群已就位** | `flow_legal`(`entry_swarm='legal'`)已实测 quality 4.71、C1/C2/C3 全 PASS,自带 C6–C10 领域 QA。**后端零改动**,不进 `jiqun_ai_fresh`。 |
| **最简单(范式齐全)** | 90% 照抄吏部 recruit 真链(信封/验真/轮询/灰徽转帝金)+ 工部「字段标记」范式。真正新写的只有一个纯函数 + 一段 UI 分层。 |
| **无产线命门** | 法律意见**是咨询产出,非产线资产**(不像工部的报价/BOM/交期),所以不写主库 `tasks`、不触发真实对外副作用——纯前端 CourtOS runtime 即可承载(§13.2#9 边界内)。 |
| **补上范式缺口** | 吏部无人工确认门(约面试,后果轻);工部剥离产线资产(连内容都不给)。刑部第一次实现「**内容可读供研判、但后果性结论禁一键采纳**」这道 §8.7 人工确认门——是 Loop 的真实新能力,不是重复造。 |

**一句话**:金标蜂群现成、范式现成、无产线副作用、且补一道真正缺失的治理门——下一条真链非刑部莫属。

---

## 3. 架构(精确路径 + 每文件关键结构)

### 路由命名裁定(消除四份设计分歧)

现存 BFF 统一 `{部门连字符}/{能力名}`:`li-bu/recruit`、`gong-bu/feasibility`。刑部照此 = **`xing-bu/legal`**(弃用某份设计里的 `consult` 命名,与现状一致)。

### 新增 9 文件(刑部地盘,新增为主,不碰别窗口活跃文件)

```
src/core/courtos/runtime/legal-envelope.ts              # 诚实信封(照 recruit-envelope)
src/core/courtos/runtime/legal-envelope.nodetest.ts     # 诚实闸回归断言(铁律4)
src/core/courtos/runtime/legal-consequence.ts           # ★命门:后果性字段分类 + worst-wins blast
src/core/courtos/runtime/legal-consequence.nodetest.ts  # ★命门回归断言(铁律4)
src/core/courtos/runtime/legal-verdict.ts               # 裁断句(照 recruit-verdict,无 approve)
src/core/courtos/runtime/legal-verdict.nodetest.ts      # 裁断回归断言(可选)
src/app/api/court/dept/xing-bu/legal/route.ts           # BFF 点火(ENTRY_SWARM='legal')
src/app/api/court/dept/xing-bu/legal/result/route.ts    # result:不剥离,但分类标后果性
src/features/legal/components/live-legal-panel.tsx       # 自包含真链卡(照 live-recruit-panel)
```
> `src/features/legal/components/` 目录**已存在**(空),直接落 panel。

### 复用(import,零改动 —— 铁律2 SSOT)

| 复用 | 来自(已确认真实) | 用途 |
|---|---|---|
| `reverifyLiveSwarmTrace` | `src/core/courtos/runtime/reverify-swarm-trace.ts` | 验真承重墙(诚实闸核心) |
| `isGenuineSwarmTraceId` | `src/core/courtos/source-label.ts` | result 预闸 |
| `BlastRadius` 类型 | `src/features/governance/lib/gate.ts` | blast 类型 SSOT,不重定义 |
| `classifyXingbuLegalRiskQuestion` / `inferForbiddenActions` / `inferCrossDepartmentReviews` | `src/core/courtos/xingbu/xingbu-clo-cco-office.ts` | 法律风险 11 类分类 + 禁止动作 + 跨部门会审 |
| `XingbuLegalRiskQuestionType` / `XingbuCrossDepartmentReview` | `src/core/courtos/xingbu/xingbu-types.ts` | 信封字段类型 |
| `ConfidenceSourceBadge` / `sourceToLabel` | `src/features/personnel/components/confidence-source-badge.tsx` | LIVE_SWARM=帝金 / FALLBACK=灰 |
| `SourceLabel` | `src/core/courtos/runtime/.../types`(同 recruit import 路径) | 来源标签联合类型 |

### 每文件关键结构

**① `legal-envelope.ts`** — 照抄 `buildFeasibilityEnvelope`/`buildRecruitEnvelope` 结构,仅改文案。诚实闸唯一逻辑:`!jiqunOk || !sessionId || reverify.verified !== true` → `FALLBACK`;仅验真过 → `LIVE_SWARM`。
```ts
export interface LegalEnvelope {
  success: boolean; sourceLabel: SourceLabel; trace_id: string | null;
  status: 'running' | 'failed'; confidence: number;
  missingEvidence: string[]; reverifyReason: string; message: string;
}
export function buildLegalEnvelope(input: LegalInput): LegalEnvelope { /* 同 recruit,文案改"法务蜂群" */ }
```

**② `legal-consequence.ts`** — 刑部命门(对标工部 `isProductionAssetField`/`stripProductionFields`,但**不剥离 body**,只分类标锁)。返回结构与 `stripProductionFields` 同构(`{ consult, ... }`),便于 result 路由对称调用:
```ts
import type { BlastRadius } from '@/features/governance/lib/gate'; // SSOT
import { classifyXingbuLegalRiskQuestion, inferForbiddenActions,
         inferCrossDepartmentReviews } from '@/core/courtos/xingbu/xingbu-clo-cco-office';

// 后果性字段白名单(SSOT)—— 字段名以真实 final_output 键为准,见 §9 R2
const CONSEQUENTIAL_FIELDS = ['核心条款建议', '法务决策建议', '争议与执行方案'] as const;
// 内容级高危词(命中即升级,即便字段名是"清单")
const LOCK_MARKERS = ['违约金','独家','排他','知识产权','著作权','专利','商业秘密',
  '归属','对外','外发','发函','律师函','起诉','仲裁','付款','预付款','保证金','签署','盖章','报价'];

export interface LegalFieldGate {
  field: string; body: string;
  humanConfirmationRequired: boolean;  // true=禁一键采纳,必走确认门
  blastRadius: BlastRadius;            // external(对外立场) / internal
  legalRiskType: ReturnType<typeof classifyXingbuLegalRiskQuestion>;
  forbiddenActions: string[];          // 来自 inferForbiddenActions
}

export function gateLegalField(field: string, body: string): LegalFieldGate { /* 见下 fail-secure */ }

// result 调用:返回 consult(放行) + consequentialFields(上锁,body 仍带) + 顶层 worst-wins
export function classifyLegalOutput(finalOutput: Record<string, unknown> | null): {
  consult: Record<string, string>;
  consequentialFields: LegalFieldGate[];
  humanConfirmationRequired: boolean;  // 任一锁 → true(整卡禁一键采纳)
  blastRadius: BlastRadius;            // worst-wins: external > internal
  forbiddenActions: string[];          // 全字段并集去重
} { /* 遍历分类,worst-wins 折叠 */ }
```
> **fail-secure(Schneier 命门)**:`gateLegalField` 判定 = `CONSEQUENTIAL_FIELDS.includes(field) || LOCK_MARKERS.some(w=>body.includes(w)) || classify 非 OTHER`。**拿不准默认锁**,绝不 `?? consult` 静默放行;命不中宁可多锁让老板手动开。

**③ `legal-verdict.ts`** — 照抄 `recruit-verdict.ts`,从真 `qa_result`/`quality_score` 抬裁断句。**关键差异:disposition 无 `approve`**,只 `advise`(供研判)/`hold`(提请确认)/`reject`;含后果性字段时 disposition 封顶 `hold`、`humanConfirmationRequired=true`、文案绝不含"准奏/可采纳"(AI 不给法律意见盖章,§13.2#5)。

**④ `route.ts`** — 照抄 `li-bu/recruit/route.ts`,仅改:`ENTRY_SWARM='legal'`、文案、`buildLegalEnvelope`。透传 cookie(decode-only,硬约束#1,禁 jose/JWKS),`MAX_INPUT=2000`,**不写主库 `tasks`**。

**⑤ `result/route.ts`** — 照抄 `gong-bu/feasibility/result/route.ts`,但把 `stripProductionFields` 换成 `classifyLegalOutput`(**不剥离,只分类**)。`ready = reverify.verified && session.synthetic!==true && status==='completed'`;`!ready` → `consult:{}`、`consequentialFields:[]`、`FALLBACK`(不让未验产出整形出镜)。

---

## 4. 刑部专属:高危法律人工确认门

### 触发判定(可代码化,纯函数 `gateLegalField`)

```
确认门触发 = 字段在后果白名单  OR  内容命中 LOCK_MARKERS  OR  风险类型非 OTHER_LEGAL_RISK
```

| flow_legal 字段 | 性质 | 默认 | 理由 |
|---|---|---|---|
| 合同背景与适用法域 | 定性 | 放行 consult | 陈述事实,无对外后果 |
| 风险识别清单 | 定性 | 放行 consult | 列风险=帮老板看见 |
| 合规审查结论 | 定性 | 放行 consult(标"非正式法律意见") | 结论性但不直接对外 |
| **争议与执行方案** | **后果** | **锁** | 触发诉讼/仲裁/催收=不可逆对外 |
| **核心条款建议** | **后果** | **锁** | 违约金比例/独家/IP 归属藏在这里 |
| **法务决策建议** | **后果** | **锁** | "该不该签/发"的对外法律立场 |

**双层 OR(命门)**:字段级 + 内容级。即便高危词出现在名义为"风险识别清单"的定性字段里,`LOCK_MARKERS` 命中 → 仍升级为锁。只靠字段名白名单可被 flow_legal 一次换名绕过。

### 信封携带字段(顶层硬标 + 逐字段)

```ts
// result 响应 data:
{
  sourceLabel, trace_id, status, qualityScore, verdict,
  consult: Record<string,string>,           // 4 放行字段全文
  consequentialFields: LegalFieldGate[],     // 2-3 后果字段(body 仍带 + humanConfirmationRequired + blastRadius + forbiddenActions)
  humanConfirmationRequired: boolean,        // ★顶层单点裁决:任一锁 → true
  blastRadius: BlastRadius,                  // ★worst-wins
  forbiddenActions: string[],
}
```
> **后端单点裁决(Russell 命门)**:`humanConfirmationRequired` 在 result 路由计算,前端**无自由裁量权**——拿到 true 就把"采纳"按钮在 DOM 层物理换成"提请人工确认门"。审计只看 result 一处响应。

### 复用 gate.ts(SSOT)

- `BlastRadius` 类型从 `gate.ts` import,后果字段标 `external`,worst-wins 折叠。
- **只 import 类型/判定语义,不调 `assertGatePassed`/archive 闸**——咨询类不归档史馆(铁律5:溶解进上书房裁决,不新增归档版面)。

---

## 5. UI:LiveLegalPanel

### 结构(照 `live-recruit-panel.tsx` 自包含范式)

```
LiveLegalPanel  ('use client', props { defaultInput?: string })
├── header   真链·刑部法务蜂群 / 「法律会诊(LIVE)」 + fallback 灰徽
├── textarea 输入合同条款/法律问题(限 2000,BFF 校验)
├── button   「会诊(真启蜂群)」 / running「蜂群运算中…」
└── phase==='done' && data:
    ├── ⟪结论先行⟫ verdict 单句 22px 帝金/赤 + ConfidenceSourceBadge
    ├── ⟪高危警戒带⟫ 仅当 humanConfirmationRequired → 赤红 banner(ShieldAlert)
    ├── ⟪consult chips⟫  灰 chip,点开渐进披露全文(4 字段)
    └── ⟪consequentialFields chips⟫ 赤红描边 + 🔒锁标 + "需确认"(2-3 字段)
        └── 展开区:顶部 sticky 人工确认门带 + 文末禁用"提请人工确认"按钮(无采纳钮)
```

### 渐进披露(Rams:结论先行)

1. **第一眼**:一句 verdict + 一个把握度徽(老板 90% 只看这行)。
2. **第二眼**:高危警戒带 + mustResolve(缓奏补证清单)。
3. **点开才看**:6 字段 chip。`expanded=null` 默认全收起,绝不平铺 6 段法律长文。

### 高危标注(humanConfirmationRequired 的 UI 落点)

- 后果字段 chip:赤红描边 `#F43F5E` + `LockKeyhole` 图标 + "需确认"。
- 展开区无"采纳"绿钮,**只有 `disabled` 的"提请人工确认(不可一键采纳)"按钮**——采纳路径物理不存在(不是点了弹窗,是按钮锁死)。
- 两个真出口替代采纳:`转后端军机处确认 →`(HTTP 转 jiqun :8081,真签约/发函=产线,§13.2#9)、`提请人工法务`(标 needs_signoff)。
- **徽色诚实正交于锁**:徽=这条多可信(帝金/灰);锁=可信也不能替你表态。

### 接进 xingbu-client(铁律5:溶解,不新增版面)

`xingbu-client.tsx`(881 行,**现状 clean**)**只改两处**,不动 `useLegalData`/三面板/`DecreeInput`/视觉资产:
1. 顶部 import:`import { LiveLegalPanel } from '@/features/legal/components/live-legal-panel';`
2. 左面板"案件入口"插一处内联折叠卡(用现有 div+Tailwind,不新增抽屉组件):
```tsx
<LiveLegalPanel
  defaultInput={selectedCase ? `就案号${selectedCase.caseNumber}「${selectedCase.title}」做法律会诊：${selectedCase.summary}` : ''}
/>
```
> 选中案件自动带入案情。`useLegalData`(沙盘案卷,DEMO/turso)与 `LiveLegalPanel`(真启蜂群,LIVE_SWARM)互补不冲突,徽色一眼区分谁真谁假。真实数据源明确 = flow_legal 蜂群,符合铁律5"溶得进就不新增版面"。

---

## 6. 建设序列(可勾选 checklist,每步带验证)

### 0. 开工前
- [ ] `pwd` = `/home/ubuntu/workspace/frontend/chaotang-web-lyt`,`git remote -v` 指 `chaotang-web-lyt.git`
- [ ] `git switch -c feat/xingbu-legal-chain`(隔离 master 现有 dirty)
- [ ] **`curl` 一次真 `flow_legal` 取真实 `final_output` 键名**,核对后果字段中文 key(写 marker 前必做,见 §9 R2)
- [ ] 确认后端 `:8081` 在跑(`serve-dev.sh`),后端动作=零

### 1. 纯函数层(先写先测)
- [ ] `legal-envelope.ts`(照 recruit-envelope)→ `node --experimental-strip-types --test legal-envelope.nodetest.ts`
- [ ] `legal-consequence.ts`(命门,照 gongbu strip 结构但不剥离)→ 同上跑 `legal-consequence.nodetest.ts`
- [ ] `legal-verdict.ts`(照 recruit-verdict,删 approve)→ 可选 nodetest
- [ ] 验证:`pnpm exec tsc --noEmit`

### 2. BFF 层
- [ ] `xing-bu/legal/route.ts`(照 li-bu/recruit,`ENTRY_SWARM='legal'`,不写 tasks)
- [ ] `xing-bu/legal/result/route.ts`(照 gong-bu/feasibility result,`stripProductionFields`→`classifyLegalOutput`)
- [ ] 验证(真链冒烟,后端起着):
  `curl -s -X POST localhost:3002/api/court/dept/xing-bu/legal -d '{"task_input":"审查储能EPC总包合同违约金条款"}'` → 看 `sourceLabel`/`trace_id`;拿 trace_id 轮询 result,确认后果字段带 `humanConfirmationRequired`、consult 出 4 字段。**后端没起 → 必须看到 FALLBACK,非 500、非假 LIVE。**

### 3. UI 层
- [ ] `live-legal-panel.tsx`(照 live-recruit-panel + §5 高危分层)
- [ ] `xingbu-client.tsx` 接线(改 2 处;接线前 `git status --porcelain | grep xingbu-client` 确认 clean)
- [ ] 验证:`NEXT_DIST_DIR=.next-legal-verify pnpm build`(隔离 dist,不顶生产;Next typecheck 比 tsc 严)

### 4. E2E + 会审
- [ ] `e2e/xingbu-legal-chain.spec.ts`(照成员页范式:`addCookies`+`addInitScript` 双门 + `page.route` mock 三态)
- [ ] **独立 `code-reviewer` 子 agent 读真 `git diff`**(铁律4,禁自审)
- [ ] 文件级 `git add`(只刑部 9 新文件 + xingbu-client),**禁 `git add .`**;提交前 `pnpm build` 自检

---

## 7. 回归断言(铁律4 — 命中"给裁决加视觉权重"判据,强制)

**`legal-consequence.nodetest.ts`(命门钉死,最少 3 条):**
```
1【后果字段必锁且不漏进 consult】喂含 核心条款建议/法务决策建议 的 final_output →
  两字段在 consequentialFields 且 humanConfirmationRequired===true;
  assert.equal(consult['核心条款建议'], undefined)(锁字段绝不漏进可采纳面)。
2【内容级升级】风险识别清单 里出现 "违约金30%/独家3年/IP归属甲方" →
  即便字段名是"清单",仍被锁(LOCK_MARKERS 命中升级)。
3【worst-wins】任一字段 external → 顶层 blastRadius==='external' 且整卡 humanConfirmationRequired===true。
4【咨询字段不误锁】isConsequentialLegalField('合同背景与适用法域')===false。
```

**`legal-envelope.nodetest.ts`(照 recruit-envelope.nodetest):**
```
5【FALLBACK 不冒充】reverify.verified===false → sourceLabel==='FALLBACK';
  jiqunOk:false → FALLBACK + confidence:0;仅 verified:true → LIVE_SWARM。
```

**E2E DOM 断言(把"门"钉成视觉,Deming:摩擦必须可测量):**
```
6 expect(后果区).not.toContainText('采纳') 且后果 chip 有红/琥珀 border-color。
```

---

## 8. 验收标准(端到端)

输入一份合同问题(如"审查储能 EPC 总包合同违约金条款"),验收通过 = 同时满足:
1. **真启蜂群**:`/api/court/dept/xing-bu/legal` 返回真 `trace_id`,经 `reverifyLiveSwarmTrace` 验真。
2. **帝金法律意见**:验真过 → `sourceLabel==='LIVE_SWARM'`,首屏 verdict 单句 + 帝金徽;4 个 consult 字段可渐进披露。
3. **高危条款需人工确认**:`核心条款建议`/`法务决策建议` 渲染为赤红锁 chip + 警戒带;展开区**无"采纳"按钮**,只有禁用的"提请人工确认";顶层 `humanConfirmationRequired===true`。
4. **诚实降级**:后端没起 → `FALLBACK` 灰徽,不返后果字段内容,绝不假 LIVE、绝不 500。
5. **不污染主库**:`git diff` 无 `upsertPrimaryTask`/`INTO tasks`;朝报/史馆零污染。

---

## 9. 风险与地盘注意

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | **后果字段从 consult 泄漏** → 当可一键采纳的定论,等于默认对外法律立场(§8.7) | CRITICAL | `classifyLegalOutput` 物理隔离;断言1 钉死;面板后果区无采纳钮 |
| R2 | **字段名猜错** → marker 匹配不上真实 `final_output` 键,后果字段漏标放行 | CRITICAL | 写 marker 前 `curl` 取真键;fail-closed(命不中多锁);`logger.warn` 不静默 `?? consult` |
| R3 | **FALLBACK 静默冒充 LIVE_SWARM** | HIGH | 复用 `reverifyLiveSwarmTrace` 承重墙;断言5;result 仅 verified+completed 出产出 |
| R4 | **误写主库 tasks** 污染朝报 | HIGH | BFF 不调任何 `upsertPrimaryTask`/`INTO tasks`;`git diff` 自查 |
| R5 | **混提 master 现有 dirty** 搞红 build | HIGH | 新分支 + 文件级 `git add`,禁 `git add .`(§13.2#10) |
| R6 | **越界做产线**(前端 BFF 自建发函/签约) | MED | 咨询走本链;真对外动作转后端军机处,本链只到"转后端确认"提示(§13.2#9) |

**地盘**:本分支 master churning(多窗口活跃 gongbu/shangshufang/command-center 等)。刑部**几乎全是新增文件**(9 新),唯一共享改动 = `xingbu-client.tsx`(刑部专属,非 SoT,不需 `[shared]`)。接线前确认它 clean(现状 clean)。不碰 core-builder(`src/core/courtos/**` 其他活跃文件)/fusion(`e2e/**`)地盘外的活跃改动——但 `src/core/courtos/runtime/legal-*` 是本链新增,无冲突。

---

🎲 大神视角(bruce-schneier + stuart-russell)
⚠️ 警示:最危险的不是假 trace 盖帝金(承重墙已焊死),而是**后果字段的视觉降级**——只要面板把"法务决策建议"和"合同背景"渲染成同一种 chip,老板就会用同一手势对待,`humanConfirmationRequired` 这个布尔值就成了没人看的注释。人工确认门若不在视觉上制造摩擦感,等于没有门(断言6 就是钉这个)。
💡 天才建议:给后果字段展开区加**"复制即追加免责水印"**——老板复制"核心条款建议"全文,剪贴板末尾自动拼 `【刑部蜂群咨询意见,未经人工核准,不构成对外法律承诺 · trace_id:xxx】`。让"咨询≠定论"跟着文本走出系统,而非只活在那个会被忽略的红框里。