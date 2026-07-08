"""scripts/demo_verdict.py — 刑部判决 当面 demo(一条命令,真 LLM,出卷宗判决卡)。

给客户演示用:贴一份合同 → 终端里出一张卷宗×现代 判决卡(灯/结论/挡了什么/Top风险/接地/留痕)。
不等前端仓,今天就能当面拍给老板看。

用法:
  python3 scripts/demo_verdict.py 合同.txt
  python3 scripts/demo_verdict.py "储能采购合同:尾款验收后付,未约定验收标准,违约金不设上限。"
  echo "合同全文" | python3 scripts/demo_verdict.py
需 LLM 网关(active provider,已配 DeepSeek);无网关时用 --mock 看版式。
"""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

_LIGHT = {"green": "🟢 可放行", "yellow": "🟡 可签·须先改",
          "red": "🔴 暂不可签", "black": "⚫ 高危·移交深查"}
_LVL = {"red": "🔴", "yellow": "🟡", "green": "🟢"}


def render(doc: dict) -> str:
    w = 52
    line = "─" * w
    out = []
    out.append("╔" + "═" * w + "╗")
    out.append(f"║ ⚖️  刑部判决书   〔天平印〕案号 {doc.get('case_id','')[:22]:<22}".ljust(w + 1) + "║")
    out.append("╟" + line + "╢")
    lt = _LIGHT.get(doc.get("light"), doc.get("light", ""))
    out.append(f"║ {lt}".ljust(w + 1) + "║")
    head = (doc.get("headline") or "")[:w - 2]
    out.append(f"║ {head}".ljust(w + 1) + "║")
    if doc.get("shielded"):
        out.append("║".ljust(w + 1) + "║")
        out.append(f"║ 🛡 {str(doc['shielded'])[:w - 4]}".ljust(w + 1) + "║")
    out.append("╟" + line + "╢")
    out.append("║ 致命风险 Top（按赔率）".ljust(w + 1) + "║")
    for i, it in enumerate(doc.get("items", [])[:5], 1):
        mk = _LVL.get(it.get("level"), "·")
        title = str(it.get("title", ""))[:w - 8]
        out.append(f"║  {i}{mk} {title}".ljust(w + 1) + "║")
        fix = it.get("fix")
        if fix:
            out.append(f"║      改：{str(fix)[:w - 8]}".ljust(w + 1) + "║")
    out.append("╟" + line + "╢")
    prov = doc.get("provenance", {})
    ground = {"rag": "法条接地", "deterministic": "重算接地", "none": "未接地·需人工"}.get(
        prov.get("grounding"), prov.get("grounding", ""))
    out.append(f"║ 接地：{ground}  门：{prov.get('gate','')}  签字：{doc.get('signed')}".ljust(w + 1) + "║")
    out.append(f"║ [一键改] [开庭] [存证]   〔骑缝·天平印〕留痕 {prov.get('archive_id') or '-'}".ljust(w + 1) + "║")
    out.append("╚" + "═" * w + "╝")
    return "\n".join(out)


def _read_input(args: list[str]) -> str:
    real = [a for a in args if a != "--mock"]
    if real:
        p = Path(real[0])
        return p.read_text(encoding="utf-8") if p.exists() else real[0]
    return sys.stdin.read()


def main() -> int:
    args = sys.argv[1:]
    if "--mock" in args:
        doc = {"case_id": "XB-DEMO-001", "light": "yellow",
               "headline": "可签 —— 但先改 2 处,否则有风险",
               "shielded": "为你挡了：80万尾款拖欠口子",
               "items": [{"level": "red", "title": "验收标准模糊", "fix": "加'验收以X报告为准,7日不反馈视同通过'"},
                         {"level": "yellow", "title": "违约金无上限", "fix": "封顶合同额30%"}],
               "provenance": {"grounding": "rag", "gate": "passed", "archive_id": "XB-DEMO-001"},
               "signed": False}
    else:
        text = _read_input(args).strip()
        if not text:
            print("用法: python3 scripts/demo_verdict.py 合同.txt | \"合同文本\" [--mock]", file=sys.stderr)
            return 2
        import web.main  # 加载 .env(LLM 网关)
        from src.xingbu_verdict import run_verdict_from_text
        print("⏳ 刑部审理中（真 LLM + 法条检索）…", file=sys.stderr)
        doc = run_verdict_from_text(text, archive=True)
    print(render(doc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
