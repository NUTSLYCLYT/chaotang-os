# P7 独立复审（Opus reviewer，2026-07-17）

| 项 | 值 |
| --- | --- |
| 复审者 | Claude Opus 4.8（本会话），只读复审，未改动被审对象 |
| 被审 Packet | P7 `docs-absorption-closeout-20260717` |
| 被审对象位置 | 远端 ext 对象 `37542c3c`（本地可寻址；只读 worktree 检出复审，未碰 ext 工作树） |
| P7 前序基点 | `f5fa714`（P6 merge） |
| 触发原因 | 用户指出 P7 可能存在"写者自审"，要求独立复审 |

## 为什么要这份复审

远端 ext 已含 P7 的 `packet_review/approval-v1.json`（`verdict: PACKET_REVIEW_GO`，
`status: LOCAL_FEEDBACK_ONLY`）与 `review-v1.md`。`review-v1.md` 自称由独立
**claude-fable-5** 会话执行；`summary.md` 的 Owner 为 Project Agent(Codex)。写者/审查者
是否真正分离，从本地无法验证作者身份。故不采信既有 GO，由本会话独立重算重跑。

## 独立实测（本会话亲跑/亲算，非转述）

| 声称 | 本会话实测 | 判定 |
| --- | --- | --- |
| 唯一代码改动 = `test_commit_closeout_check.py` fixture 去耦合 | `check_doc_duplicates` @ `commit_closeout_check.py:133` 以 `cwd=ROOT` 跑 `git ls-files docs`；`_track_doc` 的 `monkeypatch.setattr(closeout,"ROOT",tmp_path)` 命中同一模块级 ROOT，机制正确 | 正确 |
| closeout 测试 9 passed | 只读 worktree 实跑 `pytest -q tests/test_commit_closeout_check.py` → **9 passed** | 一致 |
| 当前 LOC 240856 | 同口径命令重算 → **240856 total** | 一致 |
| P0 LOC 238894 | `chore-absorption-baseline-20260714/baseline.md:67` 确认 | 一致 |
| net +1962（负增长目标 NOT_MET） | 240856−238894 = **+1962** | 一致，诚实标 NOT_MET |
| P7 不动生产码 | `git diff --stat f5fa714..37542c3c -- backend/src backend/web frontend/src` → **空** | 证实：docs+test only，无自我美化空间 |

## KPI 对账质量评估

`kpi-reconciliation.md` 的核心优点：把三个层级**分开计数**，不混为一谈——
1. 定义文件仍在（legacy writer 10→10、前端五规则壳 5→5：物理**未**清零，NOT_MET）；
2. 生产可达性（默认 production writer=0、前端本地裁决 production import=0：MET）；
3. 真实流量（无时间序列/窗口/采样：`INSUFFICIENT_EVIDENCE`，NOT_MET，且明确"测试制造的
   非零计数不能当生产流量"）。

只对**真正达到**的三项（默认单写、前端裁决 import 0、部门双 SSOT）判 MET；其余如实 NOT_MET。
这是正确的收官纪律。

## Findings（本会话认定）

| # | 严重度 | 发现 |
| - | --- | --- |
| 1 | LOW | 门 1 计 7/10 时，P5 靠"实现 merge + P5.1/P5.2 子包 GO"计入，无顶层 `packet_id:P5` approval JSON。已在 packet-status.md 明文披露，可辩护；建议 campaign 收官前补一份顶层 P5 核销单固化。 |
| 2 | LOW | 后端全量 2691/37skip/6fail 为申报值，本会话因超时未独立复跑全量；但 P7 不动生产码（上证），且 closeout 9 passed 已亲验、6 红项按名与 ledger 对应——全量数字非 P7 包自身的门。 |
| 3 | INFO | browser smoke = `NOT_RUN_PORT_OWNERSHIP_BLOCKED`、流量曲线 INSUFFICIENT_EVIDENCE：方向保守，正确压住 campaign DONE，非本包 blocker。 |

## Blockers

无。所有硬门（LOC 负增长、legacy 物理清零、前端五壳物理删除、流量曲线、browser、P8/P9）
均被诚实标为**未达**并**继续阻止 campaign DONE**，而非阻止 P7 包本身。

## 裁决

**PACKET_REVIEW_GO（P7 包，仅限本 Packet 合入范围）。**

范围声明：本 GO 只针对 P7 阶段对账包（docs + 一处测试 fixture 去耦合），**不构成
ABSORPTION_CAMPAIGN_DONE**。campaign 终审仍被 LOC 负增长未达、流量曲线证据不足、
browser NOT_RUN、P8 未开工、P9 NOT_GO 正确阻断。

## 未决（需用户/后续）

- 本地 ext 与远端 ext 分歧（本地 ahead 17 / behind 4）；P7 在远端，本地未合。
  合并只有 1 处文档冲突（`known-red-baseline-ledger.md`）。是否整合 + 推送 = ext 单向门，
  待用户确认 Codex 已停后执行。
- 建议 campaign 收官前补顶层 P5 核销单（Finding #1）。
