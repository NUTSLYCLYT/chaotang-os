#!/usr/bin/env python3
"""周期性 LLM-as-judge 评估器 — 生成/更新 quality_baseline.json。

定位：validate_flows.py（零成本静态）与 test_all_flows.py（全成本端到端）之间的中间层。
为每个有 golden cases 的蜂群跑 5-10 个样本，LLM 裁判打分，写入 quality_baseline.json。
validate_flows.py 在 CI 读这个文件做质量门控（质量分 < 7.0 → CI 红灯）。

何时运行:
  - 每周定期（推荐 CI 定时任务）
  - 发布前强制
  - 修改了 prompts_<id>.py 或 flow_<id>.yaml 后主动触发

用法:
  python scripts/eval_ci.py                    # 评估所有有 golden cases 的蜂群
  python scripts/eval_ci.py --swarm quotation  # 只评估某个蜂群
  python scripts/eval_ci.py --dry-run          # 只列出蜂群，不实际运行
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# 清除系统代理：DeepSeek/LiteLLM 网关都是直连，代理会导致 "No connected db." 错误
for _pvar in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(_pvar, None)

# LITELLM_PROXY_KEY 未设时回退到 MASTER_KEY（master key 不需要 DB）
if not os.environ.get("LITELLM_PROXY_KEY") and os.environ.get("LITELLM_MASTER_KEY"):
    os.environ["LITELLM_PROXY_KEY"] = os.environ["LITELLM_MASTER_KEY"]
os.chdir(ROOT)

GOLDEN_DIR = ROOT / "scripts" / "golden_cases"
BASELINE_PATH = GOLDEN_DIR / "quality_baseline.json"
PASS_THRESHOLD = 7.0


# 加载密钥（优先 .env，其次 litellm/secrets/runtime.env）
def _load_env_file(path: str) -> None:
    from pathlib import Path as _P

    p = _P(path)
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip().lstrip("export").strip()
        v = v.strip().strip('"').strip("'")
        if k:
            os.environ.setdefault(k, v)


_load_env_file(str(ROOT / ".env"))
_load_env_file(os.path.expanduser("~/litellm/secrets/runtime.env"))

# 裁判优先走 DeepSeek 直连（不依赖 LiteLLM 网关 DB），降级到 gateway
JUDGE_MODEL = os.environ.get("SCORE_JUDGE_MODEL", "deepseek-chat")
_deepseek_key = os.environ.get("DEEPSEEK_API_KEY", "")
# C 备口:真跨厂商裁判到位时,设 SCORE_JUDGE_BASE_URL + SCORE_JUDGE_KEY 即切走(破同源自评盲区,一处生效)
_judge_base = os.environ.get("SCORE_JUDGE_BASE_URL", "")
_judge_key = os.environ.get("SCORE_JUDGE_KEY", "")
if _judge_base and _judge_key:
    GATEWAY = _judge_base
    JUDGE_KEY = _judge_key
elif _deepseek_key:
    GATEWAY = "https://api.deepseek.com/v1"
    JUDGE_KEY = _deepseek_key
else:
    GATEWAY = os.environ.get("LITELLM_BASE_URL", "http://127.0.0.1:4000/v1")
    JUDGE_KEY = os.environ.get("LITELLM_PROXY_KEY") or os.environ.get("LITELLM_MASTER_KEY", "sk-noauth")

JUDGE_SYSTEM = """你是独立质量裁判，绝不维护被评对象。对照【标准答案】给【蜂群输出】打分（1-10分制）。
只输出 JSON:
{
  "accuracy": 1-10,
  "completeness": 1-10,
  "actionability": 1-10,
  "safety": 1-10,
  "no_hallucination": 1-10,
  "overall": 1-10,
  "irreversible_risk_error": true/false,
  "verdict": "优/良/及格/不及格",
  "reasons": "一句话核心评语"
}
评分锚：10=超越人工专家；7=达到合格专业水平；5=及格但需补充；3=明显缺陷；1=错误或有害。
irreversible_risk_error：输出是否含会导致不可逆后果的错误（错误电芯选型/报价致亏/安全建议错误）。"""


def _run_swarm(config_path: str, task: str, frozen_snapshot: dict | None = None) -> str:
    from src.flow_engine import FlowEngine
    from src.retrieval_snapshot import context_override_from

    # 注入冻结检索快照：带 RAG 的蜂群 input 才可复现，质量分 before/after delta 才可归因。
    # 无快照（frozen_snapshot=None）→ context_override=None → 走实时检索，向后兼容。
    override = context_override_from(frozen_snapshot)
    result = FlowEngine(config_path).run(task, context_override=override)
    fo = getattr(result, "final_output", None) or {}
    return json.dumps(fo, ensure_ascii=False) if isinstance(fo, (dict, list)) else str(fo)


def _judge(task: str, reference: str, must_not: str, output: str) -> dict:
    from openai import OpenAI

    client = OpenAI(base_url=GATEWAY, api_key=JUDGE_KEY)
    user = (
        f"【任务】{task}\n\n【标准答案/要点（人工真值）】\n{reference}\n\n"
        f"【绝不能出现的错误】{must_not or '（未指定）'}\n\n【蜂群实际输出】\n{output[:6000]}"
    )
    resp = client.chat.completions.create(
        model=JUDGE_MODEL,
        messages=[{"role": "system", "content": JUDGE_SYSTEM}, {"role": "user", "content": user}],
        temperature=0,
    )
    txt = resp.choices[0].message.content or "{}"
    s = txt[txt.find("{") : txt.rfind("}") + 1] if "{" in txt else "{}"
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return {"overall": 0, "verdict": "解析失败", "reasons": txt[:200]}


def _eval_swarm(swarm_id: str, config_path: str, cases: list[dict]) -> dict:
    """跑一个蜂群的所有 golden cases，返回汇总结果。"""
    scores = []
    details = []
    risk_errors = []

    for i, case in enumerate(cases):
        task = case["task"]
        reference = case.get("reference", "")
        must_not = case.get("must_not", "")

        # 冻结检索快照（带 RAG 的蜂群）：注入后实时检索被短路，input 可复现。
        frozen_snapshot = case.get("retrieved_snapshot")
        snap_tag = " [frozen]" if frozen_snapshot else ""
        print(f"  case {i + 1}/{len(cases)}: {task[:60]}...{snap_tag}")
        t0 = time.time()
        try:
            output = _run_swarm(config_path, task, frozen_snapshot=frozen_snapshot)
            elapsed = time.time() - t0
            verdict = _judge(task, reference, must_not, output)
            overall = float(verdict.get("overall", 0))
            scores.append(overall)
            if verdict.get("irreversible_risk_error"):
                risk_errors.append({"case": i + 1, "task": task[:80], "reasons": verdict.get("reasons", "")})
            details.append(
                {
                    "case": i + 1,
                    "task": task[:80],
                    "overall": overall,
                    "verdict": verdict.get("verdict", ""),
                    "reasons": verdict.get("reasons", ""),
                    "elapsed_s": round(elapsed, 1),
                }
            )
            print(f"    → {overall:.1f}/10 [{verdict.get('verdict', '')}] {verdict.get('reasons', '')[:60]}")
        except Exception as e:  # noqa: BLE001
            print(f"    → 运行失败: {e}")
            details.append({"case": i + 1, "task": task[:80], "overall": 0, "verdict": "运行失败", "reasons": str(e)})
            scores.append(0.0)

    avg = sum(scores) / len(scores) if scores else 0.0
    return {
        "quality_score": round(avg, 2),
        "case_count": len(cases),
        "pass": avg >= PASS_THRESHOLD,
        "risk_errors": risk_errors,
        "details": details,
        "evaluated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "judge_model": JUDGE_MODEL,
    }


def _load_baseline() -> dict:
    if BASELINE_PATH.exists():
        return json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    return {}


def _save_baseline(baseline: dict) -> None:
    BASELINE_PATH.write_text(json.dumps(baseline, ensure_ascii=False, indent=2), encoding="utf-8")


def _find_swarm_config(swarm_id: str) -> str | None:
    """从 swarm_orchestrator.yaml 找蜂群的 config 路径。"""
    import yaml

    orch = ROOT / "config" / "swarm_orchestrator.yaml"
    if not orch.exists():
        return None
    data = yaml.safe_load(orch.read_text(encoding="utf-8")) or {}
    for s in data.get("swarms", []):
        if s.get("id") == swarm_id:
            cfg = s.get("config", "")
            return str(ROOT / cfg) if cfg else None
    # 回退：直接找 flow_<id>.yaml
    p = ROOT / "config" / f"flow_{swarm_id}.yaml"
    return str(p) if p.exists() else None


def main() -> int:
    parser = argparse.ArgumentParser(description="LLM-as-judge 蜂群质量评估")
    parser.add_argument("--swarm", help="只评估指定蜂群（不传则评估全部有 golden cases 的蜂群）")
    parser.add_argument("--dry-run", action="store_true", help="列出可评估蜂群，不实际运行")
    parser.add_argument("--no-save", action="store_true", help="不写入 quality_baseline.json")
    args = parser.parse_args()

    # 找出所有有 golden cases 的蜂群
    if args.swarm:
        candidates = [args.swarm]
    else:
        candidates = [p.stem for p in GOLDEN_DIR.glob("*.json") if p.stem != "quality_baseline"]

    if not candidates:
        print("没有找到任何 golden case 文件（scripts/golden_cases/<swarm>.json）")
        return 0

    if args.dry_run:
        print(f"可评估蜂群（{len(candidates)} 个）:")
        for sid in sorted(candidates):
            gcf = GOLDEN_DIR / f"{sid}.json"
            n = len(json.loads(gcf.read_text(encoding="utf-8"))) if gcf.exists() else 0
            cfg = _find_swarm_config(sid)
            status = "✅ 配置存在" if cfg else "❌ 找不到 flow 配置"
            print(f"  {sid}: {n} 个 golden cases — {status}")
        return 0

    baseline = _load_baseline()
    failed_swarms = []
    all_pass = True

    for swarm_id in sorted(candidates):
        gcf = GOLDEN_DIR / f"{swarm_id}.json"
        if not gcf.exists():
            print(f"\n[跳过] {swarm_id}: golden case 文件不存在")
            continue

        cases = json.loads(gcf.read_text(encoding="utf-8"))
        if not cases:
            print(f"\n[跳过] {swarm_id}: golden case 列表为空")
            continue

        config_path = _find_swarm_config(swarm_id)
        if not config_path:
            print(f"\n[跳过] {swarm_id}: 找不到 flow 配置文件")
            continue

        print(f"\n{'─' * 60}")
        print(f"评估蜂群: {swarm_id} ({len(cases)} 个 cases)")
        result = _eval_swarm(swarm_id, config_path, cases)
        baseline[swarm_id] = result

        score = result["quality_score"]
        status = "✅ PASS" if result["pass"] else "❌ FAIL"
        print(f"  → 综合质量分: {score:.2f}/10 {status}")
        if result["risk_errors"]:
            print(f"  ⚠️  {len(result['risk_errors'])} 个不可逆风险错误！")
            for re in result["risk_errors"]:
                print(f"      case {re['case']}: {re['task'][:60]} — {re['reasons'][:80]}")
        if not result["pass"]:
            all_pass = False
            failed_swarms.append(swarm_id)

    if not args.no_save:
        _save_baseline(baseline)
        print(f"\n✅ quality_baseline.json 已更新: {BASELINE_PATH}")

    print(f"\n{'═' * 60}")
    print(f"评估完成: {len(candidates)} 个蜂群")
    if failed_swarms:
        print(f"❌ 质量不达标（< {PASS_THRESHOLD}）: {', '.join(failed_swarms)}")
        print("   → 运行 validate_flows.py 将会 CI 红灯")
        return 1
    print(f"✅ 全部蜂群质量达标（≥ {PASS_THRESHOLD}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
