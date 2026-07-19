# Codex 部门-agent 架构 独立复审（Opus 编排，2026-07-18）

Legacy-Review-Verdict: PACKET_REVIEW_NO_GO
Legacy-Review-Resolved-By: .harness/changes/fix-menxia-veto-enforcement-p16-20260719/packet_review/review-v2.md
Legacy-Review-Resolved-By: .harness/changes/fix-gongbu-battery-safety-p17-20260719/packet_review/review-v1.md

| 项 | 值 |
| --- | --- |
| 被审 | Codex 的 PKT-1~5 department-agent 架构（chancellor / 门下省 menxia veto / 阁员 personas / real engines），local ext `a1c918d`（相对远端基线 `37542c3c`） |
| 复审方式 | 两个独立 code-reviewer 子代理（全新上下文，对抗性，各跑测试+变异）+ 编排者对两条关键发现的独立 repro |
| Codex 自评 | `merge-p6-...` 持 `PACKET_REVIEW_GO`（P6.1，LOCAL_FEEDBACK_ONLY） |
| **本复审裁决** | **NO_GO**（2 子代理均 NO_GO；2 条关键缺陷经编排者独立 repro 确认） |

## CRITICAL — 门下省 veto 计算封驳但无人执行（3 次独立确认）

`menxia_veto.review_route()` 单元正确、确被调用（`chancellor/routing_service.py:152`），
但 `verdict=="封驳"` 分支**只改 route 元数据**（`humanSignoffRequired=True` + 风险旗 +
把 `reason` 改写成产品文案「未获准奏前不得进入军机处派单」），**不 raise、不 return、
不清空 departments、不改 mode**，随后照常构建持久化 `RouteDecisionV2`、生成奏折、
`enqueue_dispatch` 入队真实执行。

- `src/execution/` 全树 grep `human_confirmation_required`/`封驳` = **0**——派单路径从不读该旗。
- `canonical_court_dispatch.py:200,230`：`enqueue_dispatch(..., human_confirmed=True)` **硬编码 True**，
  与 veto 语义相反。
- 唯一读该旗处是 `court_compat.py:388` 的 UI 展示字段（派单之后），拦不住任何东西。

**净效果**：系统自己判定「不属于任何部门职责、不得派单」的任务，**仍被无条件派去真实执行**，
且产品输出带一句**虚假的人可见安全声明**——比静默 mislabel 更糟（是主动撒谎的安全承诺）。
编排者独立 repro 与两子代理一致。变异（veto 恒 False）被 `test_world_cup...` 抓——但那测试
只断言 `review_route` 的**判决字符串**，从不断言**派单被拦**：判决-非执行假绿。

## HIGH — 工部储能电池 P0 关键词漏「爆炸/起火/着火」（编排者 repro 确认）

`real_department_engines.py:859` `_GONGBU_P0_KEYWORDS = ("热失控","冒烟","漏液","燃烧")`。
实测：
- `adapt_gongbu("储能柜昨晚发生爆炸并起火…")` → **risk=P2, light=yellow**（"先隔离设备并补齐遥测"）
- `adapt_gongbu("电池模组冒烟了")` → risk=P0, light=black（正确）

**爆炸+起火的电池比冒烟的电池被判更轻**。这个 gate 的存在意义就是对 P0 强制「现场断电+撤离+
消防待命；不得远程复位/下发维修」。把爆炸起火降级成"隔离+补遥测"是有物理安全后果的假阴性，
且无测试（只测了"冒烟"路径）。

## 治理评估

- **P6.1 merge 有 review + GO**，但该 GO **漏掉上述两条缺陷**：验了 `review_route` 判决对、
  验了"冒烟"路径，但没验 veto 是否真被执行、没测"爆炸"关键词。**判决-非执行 + 关键词漏项两类
  假绿**——正是 Codex 反复在我工作里抓的同一类。自审覆盖面不足。
- 早前 veto **过度封驳专署**的 NO_GO（`476768a`）**已被尊重**：`df21744` 修复，编排者 repro
  确认（锦衣卫任务 → 准奏）。故 Codex 流程非全坏，但 P6.1 GO 深度不够。
- **合的是 local ext（未推远端，远端仍 37542c3c）**——未跨远端发布门。
- **scope 授权待业主裁决**：department-agent 架构是 Codex **自提（08050ee）+ 自建 + 自审 + 自合
  local ext**。是否批准这层新架构进 ext，是业主决定，非复审能定。

## 未阻断但记录

- `chancellor_llm_recommendation.py`：诚实（provider 缺失/坏 JSON 显式 degraded，不伪造），
  但**生产从不传真 call_fn**（`chancellor_router.py:78`），100% inert——YAGNI 脚手架。
- `menxia_veto.py` `round_number<MAX` fail-open 分支：生产恒 round=1，当前不可达；一旦接
  重试轮次会变成三振绕过。
- `CHAOTANG_MENXIA_VETO` env 开关：现在 gate 一个 no-op；一旦加真执行，这个未鉴权 env 开关
  成安全绕过面。
- `departments.yaml` 只扩 `routing_keywords`（含 jinyiwei 首次补词），无 ID 漂移；但扩词使
  DENY 更少（当前无影响因 veto 本就不执行）。
- cluster-mode 额外部门未被 explicit-department 修复抑制（MEDIUM，无测试）。
- 通过项：`adapt_gongbu` 不伪造（除关键词漏项）、`council_persona_usage.py` 诚实、
  `minister_personas` 反幻觉条款+具名视角均标注为 LLM 议政非事实、我的 P6 隔离测试合并后原样保留。

## 合并前必须（建议给 Codex/业主）

1. veto：要么让 `humanSignoffRequired`/`human_confirmation_required` 真正在 `enqueue_dispatch`
   前拦截，要么删掉 `reason` 里那句不成立的「不得进入军机处派单」安全声明（不能留虚假安全承诺）。
2. 工部：`_GONGBU_P0_KEYWORDS` 补「爆炸/起火/着火」+ 回归测试。
3. scope + writer/reviewer 分离：业主裁决是否接受此架构进 ext。
