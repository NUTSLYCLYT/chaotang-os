# 不可逆决策签字闸 · 跨仓集成契约（后端 → chaotang-web-lyt）

> 来源：2026-06-22 大神会审第②刀（Schneier）。本仓负责后端签字真值源与 API 字段；
> 前端/对外渲染由 `chaotang-web-lyt` 按本契约消费。本文件只描述 API 契约与推荐行为，不在此维护网站规则。

## 1. 真值源（唯一）

`data/signed_decisions.jsonl`（append-only）是不可逆决策签字的**唯一真值源**。
- 写：`scripts/approve_decision.py <run_id> "姓名(职务)"`
- 读：`src/decision_guard.py` 的 `read_signoff_record / read_signoff_status / signoff_state / signoff_for / assert_executable_by_run`

不可逆 flow 清单见 `src/decision_guard.IRREVERSIBLE_FLOWS`（当前：quotation / sourcing / storage_aftercare / battery_stage_gate / pack_rd / finance / legal / appointment）。

## 2. 后端已暴露的 `signoff` 字段（非阻断标注）

以下端点的 JSON 响应已带 `signoff` 块（本仓已实现）：
- `GET /api/runs/{run_id}`
- `GET /api/runs/{run_id}/report`
- `GET /throne/runs/{run_id}`

字段结构：
```json
"signoff": {
  "irreversible": true,
  "approved": false,
  "signer": null,
  "signed_at": null,
  "decision_type": "财务结论/付款/拨备(对外承诺数字,错误致赔/亏损)"
}
```
- `irreversible=false` → 可逆，无需签字，前端可忽略。
- `irreversible=true && approved=false` → **未签字**：前端必须显式提示「ADVISORY 草案·未签字·不得作为对客户/生产/现场的执行或承诺依据」，并给出签字入口/命令。
- `irreversible=true && approved=true` → 已签字：显示签字人 `signer` 与时间 `signed_at`，可作为执行依据。

`export_report.py` 生成的 HTML 报告已内置等价横幅（红=未签字 / 绿=已签字），可直接复用其样式。

## 3. web 仓需要做的（按力度分两层）

### 层一：可见性（必做，零风险）
所有展示不可逆 flow `final_output` 的页面，读 `signoff` 字段渲染状态条；未签字时不得让原始结论看起来「可执行/已确认」。

### 层二：真执行口硬闸（涉及对外发送/写库/付款/下单等不可逆动作时必做）
任何「把不可逆输出真正交给客户 / 触发生产 / 写外部系统」的动作，**执行前**必须校验签字：
- 后端若新增此类执行端点：调用 `decision_guard.assert_executable_by_run(run_id, flow_id)`，未签字抛 `PendingSignoffError` → 返回 409，不执行。
- web 仓若直接对接外部系统：先调本仓校验接口（或落地等价的 HTTP 校验端点，TODO：本仓按需新增 `GET /api/runs/{run_id}/executable`），未签字一律阻断。

## 4. 边界与 TODO
- 本仓 `web/routers/hubu.py` 当前只 preview、不付款不写库 → 天然 fail-safe，无需硬闸。
- 其余交付面（`chaotang.py` 朝报 / `chat.py` / `voice.py` 等）若也对外展示不可逆 final_output，按第 2 节同款 `signoff_annotation(run_log)` 接入即可（helper 在 `web/run_utils.py`）。
- 待新增：面向 web 仓的 `GET /api/runs/{run_id}/executable` 硬校验端点（层二跨仓调用用）。
