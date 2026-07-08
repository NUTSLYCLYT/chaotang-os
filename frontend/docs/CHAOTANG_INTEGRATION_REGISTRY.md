# 朝堂整合宪法 · 命名/范式/守门 单一真相源(SSOT)

> 2026-06-22 · 防代码混乱的锚。两窗口并行开发,任何人(含 AI)建新部门/碰决策前先读这里。
> 原则(Jobs/张小龙):**整合 = 一套范式复用 N 次,不是 N 套散件。新东西只许是范式的一次复用,不许是新发明。**

## 一、命名 SSOT(止"libu 一名三用"之乱)
"libu/li_bu" 历史上被三个不相干的东西共用,这是最大乱源。**canonical 映射,各侧一律 import,禁新增混用:**

| 真实含义 | deptCode | 部门码(contracts/agent) | 前端 client | 蜂群 entry_swarm | API 前缀 |
|---|---|---|---|---|---|
| **吏部**(人事/HR) | `personnel` | `li_bu` | `personnel-client.tsx` | `libu`(后端蜂群名) | `/api/court/dept/li-bu/*` |
| **礼部**(出版/市场) | `market` | `li_bu_rites` | `libu-client.tsx` ⚠️名误导 | `lipu` | `/api/court/...rites` |
| **御书房**(文档检索/RAG) | — | 非部门 | `(dashboard)/libu/page.tsx` | — | `/api/libu/*` ⚠️非吏部 |

**已知债(待协调重构,别现在硬改):**
- `libu-client.tsx` 实为礼部 → 宜更名 `lipu-client.tsx`(协调 UI 窗口)。
- `/api/libu` + `src/features/libu/` 是御书房 → 宜更名 `/api/study` + `features/study`(整 feature 重构,改 URL,需协调)。
- **在重构前**:谁碰这些,先查本表确认到底指哪个,**绝不再新增一处 `libu` 混用**。

## 二、部门真链范式(ONE pattern · 复用 N 次)
新部门接真蜂群,**一律照此,零另造**(吏部 recruit 已跑通,工部设计已复用):
```
部门工位 → BFF /api/court/dept/<X> (entry_swarm=<蜂群>)
  → reverifyLiveSwarmTrace(承重墙,打 /api/swarm/sessions)
  → build<X>Envelope(诚实闸:验真过=LIVE_SWARM,否则 FALLBACK,绝不冒充)
  → ConfidenceSourceBadge(把握度+来源徽)→ 裁断卡
```
**SSOT 件(一律 import,禁平行实现·铁律2):**
| 件 | 路径 |
|---|---|
| sourceLabel 枚举/守门 | `src/core/courtos/source-label.ts`(5值,不扩) |
| 验真承重墙 | `src/core/courtos/runtime/reverify-swarm-trace.ts` |
| 诚实闸范式 | `src/core/courtos/runtime/recruit-envelope.ts`(新部门仿造) |
| BFF 范式 | `src/app/api/court/dept/li-bu/recruit/route.ts` + `/result` |
| 把握度徽 | `src/features/personnel/components/confidence-source-badge.tsx` |
| 部门 Opinion 契约 | `contracts/*`(如 `GongbuCTOCPOOpinion` 已存在,不新造) |

**新部门 checklist**:① 蜂群产出质量验过(金标 quality≥3.8)② 照范式接 ③ 触产线资产转后端(§13.2#9)④ 不写主库 tasks(咨询类)⑤ 跑 `pnpm honesty:all` 绿 ⑥ 不新增版面(溶现有工位)。

## 三、守门(机器纪律,防混乱复发)
| 命令 | 守什么 | 现状 |
|---|---|---|
| `pnpm guard:freeze` | 冻结特性别焊进生产门 | 🔴(部门学习越界未修,见 FREEZE_BYPASS_HANDOFF) |
| `pnpm guard:honesty` | 假数据别冒真(无徽) | 🔴(gongbu/libu 欠 DEMO 徽) |
| `pnpm test:core` | 验真器/诚实闸不被绕 | 🟢 |
| **`pnpm honesty:all`** | **三者合一 · 合并前必绿** | 🔴(待上两项清零) |

**规矩:`pnpm honesty:all` 是"合并前门"(pre-merge gate),不是 `pnpm build` 热路径**(避免拖慢每次本地构建)。**三道红清零后**,再考虑挂进 CI 硬门——现在硬挂会把红债变成所有人的 build 失败。

## 四、后端真相(为何"老板还不能用")
蜂群 `final_output` 结构性断裂(105 run 0 非空),产出取不回——见 `jiqun_ai_fresh/docs/SWARM_FINAL_OUTPUT_BUG_2026-06-22.md`。**前端范式全备好,等这一个后端根修,链子全活。**

## 五、不混乱的总纪律
1. 新部门 = 范式一次复用,**不许新发明**(违者=新散件)。
2. 碰命名先查本表,**绝不新增 libu 混用**;物理重构走协调。
3. 合并前 `pnpm honesty:all` 必绿。
4. 触产线资产转后端(§13.2#9);写主表过铁律4双门。
5. 最好的整合,是让"照范式做"比"另起一套"更省事。
