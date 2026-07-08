#!/usr/bin/env python3
"""PACK研发蜂群 → 单文件 HTML 报告导出器

用法:
  python scripts/export_report.py [run_id]          # 导出指定 run
  python scripts/export_report.py                    # 导出最新 run
  python scripts/export_report.py --list             # 列出最近 10 次 run

输出: reports/{run_id}.html  （自包含，无外部依赖，可直接在浏览器打开 / 打印为 PDF）
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import markdown as md_lib

    def md(text: str) -> str:
        return md_lib.markdown(
            text,
            extensions=["tables", "fenced_code", "nl2br"],
        )

except ImportError:

    def md(text: str) -> str:
        # 最小降级：换行转 <br>，保留原文
        return "<pre>" + text.replace("&", "&amp;").replace("<", "&lt;") + "</pre>"


ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = ROOT / "data" / "default" / "runs"
REPORTS_DIR = ROOT / "reports"


# ─── HTML 模板 ────────────────────────────────────────────────────────────────

CSS = """
:root {
  --accent: #1a6e9b;
  --warn: #e07b00;
  --fail: #c0392b;
  --pass: #27ae60;
  --bg: #f8f9fa;
  --card: #ffffff;
  --border: #dee2e6;
  --text: #212529;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  font-size: 14px; line-height: 1.7; color: var(--text);
  background: var(--bg); padding: 0 0 60px;
}
.header {
  background: var(--accent); color: #fff; padding: 32px 40px 24px;
}
.header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
.header .meta { font-size: 12px; opacity: 0.85; }
.header .meta span { margin-right: 20px; }
.container { max-width: 960px; margin: 24px auto; padding: 0 20px; }
.card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 6px; margin-bottom: 20px; overflow: hidden;
}
.card-title {
  background: var(--accent); color: #fff;
  padding: 10px 18px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;
}
.card-body { padding: 18px; }
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 3px;
  font-size: 11px; font-weight: 600; margin-left: 8px;
}
.badge-pass  { background: #d5f5e3; color: var(--pass); }
.badge-fail  { background: #fadbd8; color: var(--fail); }
.badge-warn  { background: #fdebd0; color: var(--warn); }
.badge-info  { background: #d6eaf8; color: var(--accent); }
.qa-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
  margin-bottom: 12px;
}
.qa-dim {
  text-align: center; background: var(--bg);
  border: 1px solid var(--border); border-radius: 4px; padding: 10px 6px;
}
.qa-dim .dim-score {
  font-size: 28px; font-weight: 700; line-height: 1;
  color: var(--text);
}
.qa-dim .dim-name { font-size: 11px; color: #666; margin-top: 4px; }
.score-3 { color: var(--warn) !important; }
.score-4, .score-5 { color: var(--pass) !important; }
.score-1, .score-2 { color: var(--fail) !important; }
.issue-item {
  border-left: 3px solid var(--border); padding: 8px 12px;
  margin-bottom: 8px; background: var(--bg); border-radius: 0 4px 4px 0;
}
.issue-item.high   { border-color: var(--fail); }
.issue-item.medium { border-color: var(--warn); }
.issue-item.low    { border-color: #aaa; }
.issue-meta { font-size: 11px; color: #666; margin-bottom: 4px; }
.issue-meta b { color: var(--text); }
.step-section h2, .step-section h3, .step-section h4 {
  margin: 14px 0 6px; font-weight: 600;
}
.step-section h2 { font-size: 17px; color: var(--accent); border-bottom: 1px solid var(--border); padding-bottom: 4px; }
.step-section h3 { font-size: 15px; }
.step-section h4 { font-size: 13px; }
.step-section p  { margin-bottom: 8px; }
.step-section ul, .step-section ol { margin: 6px 0 8px 20px; }
.step-section li { margin-bottom: 3px; }
.step-section table {
  width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px;
}
.step-section table th {
  background: var(--accent); color: #fff;
  padding: 7px 10px; text-align: left; font-weight: 600;
}
.step-section table td {
  padding: 6px 10px; border-bottom: 1px solid var(--border);
}
.step-section table tr:hover td { background: #f0f7ff; }
.step-section blockquote {
  border-left: 3px solid var(--accent); padding: 6px 12px;
  margin: 8px 0; background: #f0f7ff; color: #444;
}
.step-section code {
  background: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-size: 12px;
}
.step-section pre code { display: block; padding: 10px; overflow-x: auto; }
.divider { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
.summary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.summary-table th {
  background: #f0f7ff; color: var(--accent);
  padding: 8px 12px; text-align: left; border-bottom: 2px solid var(--accent);
}
.summary-table td {
  padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top;
}
.summary-table td:first-child { font-weight: 600; width: 160px; white-space: nowrap; }
.risk-grid {
  display: grid; grid-template-columns: 2fr 1fr 2fr; gap: 6px; font-size: 13px;
}
.risk-grid .risk-header {
  font-weight: 600; color: var(--accent); padding: 4px 6px;
  border-bottom: 2px solid var(--accent); margin-bottom: 4px;
}
.risk-grid .risk-row {
  padding: 5px 6px; background: var(--bg); border-radius: 3px;
}
.risk-grid .badge-risk-high  { background: #fadbd8; color: var(--fail);   padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-align: center; }
.risk-grid .badge-risk-med   { background: #fdebd0; color: var(--warn);   padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-align: center; }
.risk-grid .badge-risk-low   { background: #d5f5e3; color: var(--pass);   padding: 3px 8px; border-radius: 3px; font-size: 11px; font-weight: 600; text-align: center; }
.total-score {
  font-size: 42px; font-weight: 700; text-align: center;
  line-height: 1; padding: 8px 0;
}
.verdict {
  font-size: 16px; font-weight: 700; text-align: center;
  padding: 8px 0 4px;
}
@media print {
  .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .card-title { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { background: #fff; }
}
"""


HTML_TMPL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
<div class="header">
  <h1>{flow_name} · 研发评估报告</h1>
  <div class="meta">
    <span>📋 任务：{task_short}</span>
    <span>🕐 {run_time}</span>
    <span>🔑 Run ID：{run_id}</span>
    <span>💰 成本：${cost_usd}</span>
    <span>🔢 Token：{tokens}</span>
  </div>
</div>
<div class="container">
{body}
</div>
</body>
</html>"""


# ─── 辅助函数 ─────────────────────────────────────────────────────────────────


def load_step(run_dir: Path, step_id: str) -> dict:
    for f in run_dir.glob(f"step_*_{step_id}.json"):
        return json.loads(f.read_text(encoding="utf-8"))
    return {}


def score_class(s: float | int) -> str:
    s = int(round(s))
    if s <= 2:
        return "score-1"
    if s == 3:
        return "score-3"
    return "score-4"


def qa_verdict_badge(result: str) -> str:
    if result == "pass":
        return '<span class="badge badge-pass">✅ PASS</span>'
    return '<span class="badge badge-fail">❌ FAIL</span>'


def render_final_output(fields: dict) -> str:
    rows = ""
    for k, v in fields.items():
        rows += f"<tr><td>{k}</td><td>{v}</td></tr>\n"
    return f"""
<div class="card">
  <div class="card-title">📊 最终方案摘要（11 字段）</div>
  <div class="card-body">
    <table class="summary-table">
      <thead><tr><th>字段</th><th>内容</th></tr></thead>
      <tbody>{rows}</tbody>
    </table>
  </div>
</div>"""


def render_risk_card(final_fields: dict, quality_score: dict) -> str:
    """渲染风险量化卡片：整合五维度门控结论、供应链风险、QA issues 和风险建议。"""

    # ── 1. 从 QA issues 提取风险行 ──────────────────────────────────────────
    issues = quality_score.get("issues", [])

    # 按 severity 分三档，构建风险网格行
    SEV_ORDER = {"high": 0, "medium": 1, "low": 2}
    sorted_issues = sorted(
        issues, key=lambda x: SEV_ORDER.get(x.get("severity", "low"), 2)
    )

    risk_rows_html = ""
    qa_suggestions: list[str] = []

    if sorted_issues:
        # 表头
        risk_rows_html += (
            '<div class="risk-header">风险项</div>'
            '<div class="risk-header">概率/等级</div>'
            '<div class="risk-header">潜在后果</div>'
        )
        for iss in sorted_issues:
            sev = iss.get("severity", "low")
            dim = iss.get("dimension", "")
            field = iss.get("field", "")
            problem = iss.get("problem", "")
            suggestion = iss.get("suggestion", "")

            label = {"high": "高", "medium": "中", "low": "低"}.get(sev, "低")
            badge_cls = {
                "high": "badge-risk-high",
                "medium": "badge-risk-med",
                "low": "badge-risk-low",
            }.get(sev, "badge-risk-low")

            # 风险项：维度+字段+问题描述
            risk_desc = f"[{dim}] {field}：{problem}" if dim or field else problem
            # 后果：若 suggestion 较长则截断显示
            consequence = (
                suggestion[:80] + ("…" if len(suggestion) > 80 else "")
                if suggestion
                else "待评估"
            )

            risk_rows_html += (
                f'<div class="risk-row">{risk_desc}</div>'
                f'<div><span class="{badge_cls}">{label}</span></div>'
                f'<div class="risk-row">{consequence}</div>'
            )

            if suggestion:
                qa_suggestions.append(suggestion)
    else:
        risk_rows_html = ""  # 无风险时不渲染网格

    # ── 2. 附加文字块：五维度结论 / 供应链风险 / 风险建议 ──────────────────
    gate_conclusion = final_fields.get("五维度评审结论", "").strip()
    supply_risk = final_fields.get("供应链可行性评估", "").strip()
    risk_advice = final_fields.get("风险与建议", "").strip()

    # ── 3. 拼装 HTML ──────────────────────────────────────────────────────────
    # 风险网格区
    if risk_rows_html:
        grid_section = f'<div class="risk-grid">{risk_rows_html}</div>'
    else:
        grid_section = '<p style="color:var(--pass); font-weight:600">✅ 本方案经QA审核未发现高优先级风险</p>'

    # 已主动解决的问题（QA suggestions 去重前5条）
    seen: set[str] = set()
    unique_suggestions: list[str] = []
    for s in qa_suggestions:
        key = s[:40]
        if key not in seen:
            seen.add(key)
            unique_suggestions.append(s)
        if len(unique_suggestions) >= 5:
            break

    if unique_suggestions:
        sugg_items = "".join(
            f"<li style='margin-bottom:4px'>{s}</li>" for s in unique_suggestions
        )
        solved_section = f"""
<div style="margin-top:12px">
  <b>我们已主动解决的问题：</b>
  <ul style="margin:6px 0 0 18px; font-size:13px; color:#444">{sugg_items}</ul>
</div>"""
    else:
        solved_section = ""

    # 五维度 & 供应链补充
    extra_blocks = ""
    if gate_conclusion:
        extra_blocks += f"""
<div style="margin-top:12px; font-size:13px">
  <b>五维度门控结论：</b><br>
  <span style="color:#444">{gate_conclusion[:300]}{"…" if len(gate_conclusion) > 300 else ""}</span>
</div>"""
    if supply_risk:
        extra_blocks += f"""
<div style="margin-top:8px; font-size:13px">
  <b>供应链风险摘要：</b><br>
  <span style="color:#444">{supply_risk[:300]}{"…" if len(supply_risk) > 300 else ""}</span>
</div>"""
    if risk_advice:
        extra_blocks += f"""
<div style="margin-top:8px; font-size:13px">
  <b>综合风险与建议：</b><br>
  <span style="color:#444">{risk_advice[:400]}{"…" if len(risk_advice) > 400 else ""}</span>
</div>"""

    # CTA 底部行动条
    cta = """
<div style="margin-top:12px; padding:10px 14px; background:#f0f7ff; border-radius:4px; display:flex; align-items:center; justify-content:space-between">
  <span>✅ 确认以上风险后，72小时内出正式报价</span>
  <a href="#" style="color:var(--accent); font-weight:600; text-decoration:none; border:1px solid var(--accent); padding:4px 12px; border-radius:4px">预约技术对接 →</a>
</div>"""

    return f"""
<div class="card">
  <div class="card-title">⚠️ 方案风险评估（如果失败，最可能失败在哪里）</div>
  <div class="card-body">
    {grid_section}
    {solved_section}
    {extra_blocks}
    {cta}
  </div>
</div>"""


def render_qa(quality_score: dict, qa_result_str: str) -> str:
    scores = quality_score.get("scores", {})
    issues = quality_score.get("issues", [])
    comment = quality_score.get("overall_comment", "")
    total = quality_score.get("total_score") or (
        sum(scores.values()) / len(scores) if scores else 0
    )

    dims_html = ""
    for name, val in scores.items():
        cls = score_class(val)
        dims_html += f"""
      <div class="qa-dim">
        <div class="dim-score {cls}">{val}</div>
        <div class="dim-name">{name}</div>
      </div>"""

    issues_html = ""
    for iss in issues:
        sev = iss.get("severity", "low")
        dim = iss.get("dimension", "")
        field = iss.get("field", "")
        agent = iss.get("source_agent", "")
        problem = iss.get("problem", "")
        suggestion = iss.get("suggestion", "")
        issues_html += f"""
    <div class="issue-item {sev}">
      <div class="issue-meta">
        <b>[{sev.upper()}]</b> &nbsp; 维度：{dim} &nbsp; 字段：{field} &nbsp; 来源：{agent}
      </div>
      <div>🔍 {problem}</div>
      <div style="color:#666; margin-top:4px">💡 {suggestion}</div>
    </div>"""

    total_cls = score_class(total)
    verdict = qa_verdict_badge(qa_result_str)

    return f"""
<div class="card">
  <div class="card-title">🔍 QA 质量评估 {verdict}</div>
  <div class="card-body">
    <div style="display:flex; gap:20px; align-items:center; margin-bottom:16px">
      <div style="text-align:center">
        <div class="total-score {total_cls}">{total:.1f}</div>
        <div style="font-size:12px; color:#666">综合评分 / 5.0</div>
      </div>
      <div style="flex:1">
        <div class="qa-grid">{dims_html}</div>
      </div>
    </div>
    <p style="color:#555; font-style:italic; margin-bottom:12px">{comment}</p>
    <hr class="divider">
    <div style="font-weight:600; margin-bottom:8px">问题清单</div>
    {issues_html if issues_html else '<p style="color:var(--pass)">✅ 无问题</p>'}
  </div>
</div>"""


def render_step_section(title: str, icon: str, output: str, badge: str = "") -> str:
    rendered = md(output) if output else "<p style='color:#999'>（无输出）</p>"
    return f"""
<div class="card">
  <div class="card-title">{icon} {title}{badge}</div>
  <div class="card-body step-section">{rendered}</div>
</div>"""


def signoff_banner_html(run_id: str, flow_id: str | None, signed_log=None) -> str:
    """不可逆决策签字横幅:以 signed_decisions.jsonl 为真值源,把交付物的"可否执行"状态显式化。

    会审第②刀:export_report 原本对 PENDING 状态完全无知,照样把原始输出渲染给客户。
    现在不可逆且未签字 → 顶部红色横幅警示"ADVISORY 草案·不得执行/对外承诺";已签字 → 绿色标注签字人。
    可逆 flow / 拿不到 flow_id → 返回空串(不打扰)。
    """
    if not flow_id:
        return ""
    try:
        from src.decision_guard import signoff_state
    except Exception:  # noqa: BLE001
        return ""
    state = signoff_state(run_id, flow_id, signed_log)
    if not state.get("irreversible"):
        return ""
    dtype = state.get("decision_type", "")
    if state.get("approved"):
        signer = state.get("signer") or "具名负责人"
        signed_at = state.get("signed_at") or ""
        return f"""
<div style="background:#d5f5e3; border:2px solid #27ae60; border-radius:6px; padding:14px 18px; margin-bottom:20px">
  <div style="font-size:15px; font-weight:700; color:#1e7e44">✅ 不可逆决策 · 已签字 — 可执行</div>
  <div style="font-size:13px; color:#333; margin-top:6px">
    决策类型：{dtype}<br>签字人：<b>{signer}</b>　签字时间：{signed_at}<br>
    本报告已由具名负责人签字批准,可作为对客户/生产/现场的执行依据。
  </div>
</div>"""
    cmd = f'python scripts/approve_decision.py {run_id} "姓名(职务)"'
    return f"""
<div style="background:#fadbd8; border:2px solid #c0392b; border-radius:6px; padding:14px 18px; margin-bottom:20px">
  <div style="font-size:15px; font-weight:700; color:#a5281b">⛔ 不可逆决策 · 未签字（ADVISORY 草案）</div>
  <div style="font-size:13px; color:#333; margin-top:6px">
    决策类型：{dtype}<br>
    本报告<b>尚未经具名负责人签字</b>,仅为 AI 建议草案,<b>不得</b>作为对客户/生产/现场的执行或承诺依据。<br>
    签字命令：<code>{cmd}</code>
  </div>
</div>"""


# ─── 主逻辑 ───────────────────────────────────────────────────────────────────


def export_run(run_id: str) -> Path:
    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise FileNotFoundError(f"run 目录不存在: {run_dir}")

    meta = (
        json.loads((run_dir / "run_meta.json").read_text(encoding="utf-8"))
        if (run_dir / "run_meta.json").exists()
        else {}
    )
    fo_data = (
        json.loads((run_dir / "final_output.json").read_text(encoding="utf-8"))
        if (run_dir / "final_output.json").exists()
        else {}
    )

    task_input = meta.get("task_input", "")
    flow_name = meta.get("flow_name", "PACK研发蜂群")
    # 非 pack_rd 蜂群(如 finance)的 run_meta 里 quality_score / qa_result 可能为 null,
    # 用 `or {}` 兜底,避免下游 render_risk_card/render_qa 对 None 调 .get 崩溃。
    quality_score = meta.get("quality_score") or {}
    qa_result_raw = fo_data.get("qa_result") or {}
    harness = (
        qa_result_raw.get("harness_metrics", {})
        if isinstance(qa_result_raw, dict)
        else {}
    )
    final_fields = fo_data.get("final_output") or {}
    qa_result_str = (
        qa_result_raw.get("qa_result", "unknown")
        if isinstance(qa_result_raw, dict)
        else "unknown"
    )

    run_time = (
        run_id[:4]
        + "-"
        + run_id[4:6]
        + "-"
        + run_id[6:8]
        + " "
        + run_id[9:11]
        + ":"
        + run_id[11:13]
    )
    cost_usd = f"{harness.get('total_cost_usd', 0):.4f}" if harness else "N/A"
    tokens = f"{harness.get('total_tokens', 0):,}" if harness else "N/A"

    # 读取关键步骤
    steps = {
        sid: load_step(run_dir, sid)
        for sid in [
            "pack_rd_leader",
            "presale_cost_estimator",
            "supply_chain_feasibility",
            "cell_engineer",
            "bms_hw_engineer",
            "bms_sw_engineer",
            "structure_thermal_engineer",
            "pack_reliability_tester",
            "expert_review_gate",
            "pack_summary_expert",
            "executive_summary",
            "critic_challenge",
        ]
    }

    def out(sid: str) -> str:
        return steps[sid].get("output", "") or ""

    def status_badge(sid: str) -> str:
        s = steps[sid].get("status", "")
        if s == "success":
            return '<span class="badge badge-pass">✅</span>'
        if s == "warning":
            return '<span class="badge badge-warn">⚠️</span>'
        if s == "error":
            return '<span class="badge badge-fail">❌</span>'
        return ""

    body_parts = []

    # 0. 不可逆决策签字横幅（最顶部）：以 signed_decisions.jsonl 为真值源,未签字不得当执行依据。
    config_path = meta.get("config_path", "")
    flow_id = Path(config_path).stem.replace("flow_", "") if config_path else None
    if not flow_id:
        from src.decision_guard import flow_id_from_name

        flow_id = flow_id_from_name(flow_name)
    banner = signoff_banner_html(run_id, flow_id)
    if banner:
        body_parts.append(banner)

    # 1. 任务输入
    body_parts.append(f"""
<div class="card">
  <div class="card-title">📥 任务输入</div>
  <div class="card-body">
    <p style="font-size:15px; color:#333">{task_input}</p>
  </div>
</div>""")

    # 2. 决策摘要（最前面，决策者优先看）
    body_parts.append(render_step_section("决策摘要", "🎯", out("executive_summary")))

    # 3. 11字段最终摘要
    if final_fields:
        body_parts.append(render_final_output(final_fields))

    # 4. 五维度评审结论
    body_parts.append(
        render_step_section(
            "五维度技术评审",
            "⚖️",
            out("expert_review_gate"),
        )
    )

    # 5. 完整方案（方案汇总专家）
    body_parts.append(
        render_step_section(
            "完整研发方案",
            "📄",
            out("pack_summary_expert"),
        )
    )

    # 5b. 风险量化卡片（紧跟方案示意，决策者可立即看到风险全貌）
    body_parts.append(render_risk_card(final_fields, quality_score))

    # 6. 各专家输出折叠区
    spec_sections = [
        ("售前成本核算", "💰", "presale_cost_estimator"),
        ("供应链可行性门控", "🔗", "supply_chain_feasibility"),
        ("电芯工程师", "🔋", "cell_engineer"),
        ("BMS 选型工程师", "🔌", "bms_hw_engineer"),
        ("通信协议适配工程师", "📡", "bms_sw_engineer"),
        ("结构&热设计&工艺工程师", "🏗️", "structure_thermal_engineer"),
        ("测试&可靠性工程师", "🧪", "pack_reliability_tester"),
    ]
    spec_html = ""
    for title, icon, sid in spec_sections:
        rendered = md(out(sid)) if out(sid) else "<p style='color:#999'>（无输出）</p>"
        spec_html += f"""
<details style="margin-bottom:10px; background:var(--card); border:1px solid var(--border); border-radius:6px; overflow:hidden">
  <summary style="padding:10px 16px; cursor:pointer; background:var(--bg); font-weight:600">
    {icon} {title} {status_badge(sid)}
  </summary>
  <div style="padding:16px" class="step-section">{rendered}</div>
</details>"""

    body_parts.append(f"""
<div class="card">
  <div class="card-title">👥 各专家详细输出（点击展开）</div>
  <div class="card-body">{spec_html}</div>
</div>""")

    # 7. QA 评估
    if quality_score:
        body_parts.append(render_qa(quality_score, qa_result_str))

    # 8. 质疑报告
    body_parts.append(
        render_step_section("质疑专家报告", "🔴", out("critic_challenge"))
    )

    # 9. 研发负责人原始需求规格
    body_parts.append(
        render_step_section(
            "研发负责人需求规格（原始）",
            "📋",
            out("pack_rd_leader"),
        )
    )

    body = "\n".join(body_parts)

    html = HTML_TMPL.format(
        title=f"PACK研发报告 {run_id}",
        css=CSS,
        flow_name=flow_name,
        task_short=task_input[:60] + ("…" if len(task_input) > 60 else ""),
        run_time=run_time,
        run_id=run_id,
        cost_usd=cost_usd,
        tokens=tokens,
        body=body,
    )

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REPORTS_DIR / f"{run_id}.html"
    out_path.write_text(html, encoding="utf-8")
    return out_path


def list_runs(n: int = 10) -> None:
    runs = sorted(RUNS_DIR.iterdir(), reverse=True)[:n]
    print(f"{'Run ID':<30} {'Flow':<20} {'Status'}")
    print("-" * 60)
    for r in runs:
        meta_file = r / "run_meta.json"
        if not meta_file.exists():
            continue
        meta = json.loads(meta_file.read_text())
        qs = meta.get("quality_score") or {}
        total = qs.get("total_score", "?")
        grade = qs.get("grade", "?")
        status = f"Grade {grade} ({total})" if grade != "?" else "in-progress"
        print(f"{r.name:<30} {meta.get('flow_name', '?')[:20]:<20} {status}")


def main() -> int:
    parser = argparse.ArgumentParser(description="导出 PACK 蜂群 HTML 报告")
    parser.add_argument("run_id", nargs="?", help="Run ID（留空则取最新）")
    parser.add_argument("--list", "-l", action="store_true", help="列出最近 run")
    args = parser.parse_args()

    if args.list:
        list_runs()
        return 0

    if args.run_id:
        run_id = args.run_id
    else:
        runs = sorted(RUNS_DIR.iterdir(), reverse=True)
        runs = [r for r in runs if (r / "final_output.json").exists()]
        if not runs:
            print("没有找到已完成的 run", file=sys.stderr)
            return 1
        run_id = runs[0].name
        print(f"使用最新 run: {run_id}")

    out_path = export_run(run_id)
    print(f"✅ 报告已生成: {out_path}")
    print(f"   浏览器打开: file://{out_path}")
    print(f"   打印为PDF:  浏览器 Ctrl+P → 另存为PDF")
    return 0


if __name__ == "__main__":
    sys.exit(main())
