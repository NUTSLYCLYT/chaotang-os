# P7 Packet Review — docs-absorption-closeout-20260717

## 审查身份与模型披露

- 审查者：独立 Claude packet reviewer，只读，未修改任何文件、未创建提交。
- 模型披露：前一 Sonnet 会话超过五分钟无输出被终止；本次审查由 **claude-fable-5**（Fable 5）执行，非原会话模型。本报告全部证据为本会话实测或 diff 直读。
- 精确范围：B=`f5fa71459f61eb6c2041d30c485e321b1d4c7303`（P6 merge），H=`78619d81ac8e57050caaad3a949a030daf05feff`。区间恰含两个提交：`a6a9174`（对账文档 + fixture 修复）、`78619d8`（summary.md 加 `Packet ID: P7` 行，2 insertions）。
- Diff 面：11 个 docs/harness 文件 + 1 个测试文件 `backend/tests/test_commit_closeout_check.py`。无生产实现、schema、API、lockfile 变更 — 与 P7 自述一致。

## 逐项核验

### 1. commit-closeout 临时 Git fixture — 正确

- `check_doc_duplicates`（`backend/scripts/commit_closeout_check.py:127-151`）以 `cwd=ROOT` 跑真实 `git ls-files docs`。
- 新 `_track_doc` helper：tmp_path 内 `git init` + `git add`（staged 文件即出现在 `ls-files` 输出，无需 commit/identity，行为正确），`monkeypatch.setattr(closeout, "ROOT", tmp_path)` 调用时读取模块级 ROOT，作用点正确，monkeypatch 自动回滚。真实 git 行为保留，fixture 自包含，不再依赖主仓 `docs/qintianjian.md` 存在。
- 实跑：`python3 -m pytest -q tests/test_commit_closeout_check.py` → **9 passed**，与 CI 摘要一致。

### 2. KPI 数值 — 全部精确复现

| 声称 | 实测 | 判定 |
| --- | --- | --- |
| P0 LOC 238894（同命令口径） | baseline.md:67 确认同命令同数值 | 一致 |
| H LOC 240856 | 复算 1425 文件 **240856** | 一致 |
| net +1962 | `2a92646..f5fa714` numstat added 6508 / deleted 4546 / **net +1962** | 一致 |
| P6 net -1273 | `d7f7436..f5fa714` added 140 / deleted 1413 / **net -1273** | 一致 |

`NOT_MET` 判定诚实：未换分母、未把测试目录扣除。P7 区间本身只改 `backend/tests/`（不在 LOC 分母内），H 处 LOC=B 处 LOC，无自我美化空间。

### 3. legacy / 前端定义 / 部门 SSOT — 有支撑

- **10 定义**：P0 baseline 原口径即 flow_store 7 + chaotang_store 3 = 10；`legacy_write_tripwire.py` allowlist 恰含这 10 个操作、且 writer ID 仅 `pytest-flow-store`/`pytest-chaotang-store` 两个（`backend/src/legacy_write_tripwire.py:23-45` 直读确认）。`tests/test_flow_store_legacy_tripwire.py` 实跑 **13 passed**。
- **production 授权 0**：allowlist 无任何 production ID，fail-closed 由上述测试覆盖。KPI 文档明确不把它扩写成“旧代码已删除”，并披露 `FENGQUN_LEGACY_WRITE_TRIPWIRE=0` rollback bypass — 诚实。
- **前端五定义仍在 / production imports 0**：`node frontend/scripts/architecture-import-guard.mjs` 实跑 → `architecture import guard: ok`。P0 baseline 确认五文件 1149 LOC 口径；P7 按 5→5 报 NOT_MET（物理），可达性口径单列 MET，两口径分离正确。
- **部门 backend1+frontend1**：由 P1 review + parity/SSOT 测试链承载；本次前端全量实跑间接覆盖（见第 6 项）。

### 4. 流量曲线缺失 — 诚实

`kpi-reconciliation.md` 第 5 节：P0 `NO_COUNTER_BASELINE`、P2/P3 仅单进程零值快照、P7 无新观测窗口，标 `INSUFFICIENT_EVIDENCE`/`NOT_MET`，并明确“测试制造的非零计数不能当生产流量”、P3 daemon 物理删除门保持 blocked。无美化。

### 5. 7/10 与 P5 计数

- P0-P4、P6 均有 review 文件与 merge SHA；P6 `approval-v2.json` 实读：`packet_id: P6, verdict: PACKET_REVIEW_GO`。
- **P5**：实现已 merge（`346dc81`），P5.1/P5.2 精确 SHA approval JSON 实读均 `PACKET_REVIEW_GO`，但无单一顶层 `packet_id: P5` approval。packet-status.md **明文披露**此构成（“implementation merged；review hardening/fixes GO；计入完成，但保留 reviewer 非阻断项”）。计入 7/10 属可辩护的判断且透明披露 — 记 LOW 观察项，非 blocker（campaign DONE 未被宣告，门 1 分母纪律本身正确：P4.5/D6/P5.x 未混入）。
- P8 NOT_STARTED、P9 PARTIAL/NOT_GO 如实登记；“P7 GO 前不得计入、最多 8/10”表述正确。

### 6. full 套件与 known-red 一致性

- **frontend**：本会话实跑 `pnpm run test:node` → **1041 tests / 1041 pass / 0 fail**，与声称精确一致；P6 七红 CLOSED 得到全量绿佐证。
- **backend**：6 个剩余红项本会话定向实跑 → **恰好 6 failed**，且与 ledger 逐名对应（lawyer_rag 4 + persona_registry munger 1 + tianjian_verdict 1）；closeout 文件 9 passed 已不在失败集。2691/37 全量总数因成本未独立复跑（LOW，见 Findings），但“6 红=ledger 剩余项精确同名”这一关键交叉已独立证实。
- ledger 更新自洽：OPEN 14→6+1 FIXED_PENDING_REVIEW，前端 7 项 CLOSED 均引 P6 证据；p7-dry-reconciliation.md 加历史快照声明防止 5/10 旧数被误引 — 好。

### 7. browser NOT_RUN — 诚实

`browser-smoke.md` 记 `NOT_RUN_PORT_OWNERSHIP_BLOCKED`，列端口占用者，明确未借用他树页面冒充证据、替代证据仅为静态/测试、**解除前 campaign 禁止 DONE**，并给出解除条件。P7 不动 frontend runtime tree（diff 证实），P4 历史 smoke 未被复用为本 SHA 证据。端口占用为时点事实未复核（不影响结论：NOT_RUN 是保守方向）。

### 8. D6 Packet ID 绑定

`scripts/lib/packet-review-local-feedback.mjs:251-253` 要求 summary 恰含一条 trim 后以 `Packet ID:` 开头且与 approval `packet_id` 完全一致的行。`78619d8` 添加的裸行 `Packet ID: P7` 满足；表格行 `| Packet ID | P7 |` 以 `|` 开头不计入，故恰好一条。格式 `P7` 匹配 `^P\d+(\.\d+)?$`。绑定正确，approval JSON 待本 review 产生 — 流程顺序正确。

## Findings

| # | 严重度 | 路径 | 发现 |
| - | --- | --- | --- |
| 1 | LOW | `.harness/changes/docs-absorption-closeout-20260717/packet-status.md` | P5 计入 7/10 基于 merge + P5.1/P5.2 子包 GO，无顶层 P5 approval JSON；已明文披露，且不影响本包（campaign DONE 未宣告）。建议 P8/P9 收官前补一份顶层 P5 核销单固化此判定 |
| 2 | LOW | `ci_summary.md` | backend 2691 passed/37 skipped 总数为申报值，本审查因成本仅独立复核 6 failed 逐名一致 + 定向集绿；总数与 ledger 无矛盾迹象 |
| 3 | INFO | `kpi-reconciliation.md` | 前端五文件 1153 LOC（1149+4）未独立复点；口径披露充分，即使有 ±数行误差不影响 5→5 NOT_MET 判定 |
| 4 | INFO | `browser-smoke.md` | 端口占用 PID 为写作时点快照，审查未复核；NOT_RUN 结论方向保守，无风险 |

## Blockers

无。所有硬门（LOC、流量、P8/P9、browser、6 红）均被诚实标记为未达且明确阻止 campaign DONE，而非阻止 P7 包本身。

## 结论

P7 是诚实的阶段对账包：唯一代码改动（fixture 去耦合）正确且 RED→GREEN 可复现；全部关键数字（238894/240856/+1962/-1273、6 红逐名、1041/1041、writer 10/授权 0、guard ok、D6 绑定）经本会话独立复算或实跑一致；未达目标全部按原口径如实标注并继续压住 campaign DONE。批准范围仅为 P7 包合入，不构成 campaign DONE。

PACKET_REVIEW_GO
