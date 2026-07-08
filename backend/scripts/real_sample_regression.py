#!/usr/bin/env python3
"""真实样本回归(deming)— 每次改判决逻辑后跑,确认引证/接地/severity 不退步。

跑 tests/real_samples/ 下所有脱敏样本(+ 命令行附加的本地真实文件),过刑部判决,
校验不变量并报告引证覆盖。需 LLM 网关(.env 里 DeepSeek/火山)。

不变量(违反即非零退出):
  ① findings 非空(判决没空转)
  ② 标 grounded 的判决必有 ≥1 条库内可核引证(不假接地)
  ③ 未接地判决 headline 含"需人工"(不冒充权威)

用法:
  python scripts/real_sample_regression.py
  python scripts/real_sample_regression.py "/mnt/h/.../某真实合同.pdf"   # 附加本地真实样本(不入仓)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_ENV = ROOT / ".env"
if _ENV.exists():
    import os
    for _l in _ENV.read_text(encoding="utf-8").splitlines():
        _l = _l.strip()
        if _l and not _l.startswith("#") and "=" in _l:
            _k, _v = _l.split("=", 1)
            os.environ.setdefault(_k, _v)

SAMPLE_DIR = ROOT / "tests" / "real_samples"


def _read(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        from pypdf import PdfReader
        return "\n".join((p.extract_text() or "") for p in PdfReader(str(path)).pages)
    return path.read_text(encoding="utf-8")


# H 盘真实双章合同实测过:扫描/拍照转的 PDF(如"扫描全能王")没有文字层,pypdf
# 抽出来只剩空白或寥寥几个字(水印)。抽取质量是这一层(pdf→text)的事,别把
# "抽取失败"和"LLM 读完真觉得没问题"混成同一种"判决空转"报错,操作者看了才知道
# 该找 OCR 还是该查判决逻辑。
_MIN_EXTRACTED_CHARS = 50


def _check(name: str, doc: dict) -> list[str]:
    fails = []
    items = doc.get("items") or []
    if not items:
        fails.append("findings 空(判决空转)")
    grounded = doc.get("provenance", {}).get("rag_grounded")
    verified = [it for it in items if it.get("basis_verified")]
    if grounded and not verified:
        fails.append("标 grounded 却无库内可核引证(假接地)")
    if not grounded and "需人工" not in (doc.get("headline") or ""):
        fails.append("未接地却未标'需人工'(冒充权威)")
    # H 盘真实扫描件合同复现过:pypdf 抽不出文字 → items 空 → 未接地却继续挂绿灯,
    # 消费方只读 light(红绿灯字段)不读 headline 细节的话,等于系统没读就说"没问题"。
    if not grounded and doc.get("light") == "green":
        fails.append("未接地却挂绿灯(light=green,冒充'审过没问题')")
    return fails


def main() -> int:
    # 网关感知:无 LLM key 时优雅跳过(exit 0),使本门可安全挂进静态 CI;有 key(nightly/本地)则强制
    import os
    if not (os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("ARK_API_KEY")):
        print("⏭️  跳过真实样本回归:无 LLM 网关(设 DEEPSEEK_API_KEY/ARK_API_KEY 后强制)")
        return 0

    samples = sorted(p for p in SAMPLE_DIR.glob("*") if p.suffix.lower() in (".txt", ".md", ".pdf")
                     and p.name != "README.md")
    samples += [Path(a) for a in sys.argv[1:] if Path(a).exists()]
    if not samples:
        print("无样本(tests/real_samples/ 放脱敏合同,或命令行传本地文件)")
        return 0

    from src.xingbu_verdict import run_verdict_from_text
    any_fail = False
    for sp in samples:
        try:
            text = _read(sp)
            if len(text.strip()) < _MIN_EXTRACTED_CHARS:
                print(f"⚠️  {sp.name}: 抽取到 {len(text.strip())} 字,疑似扫描件/图片 PDF"
                      "(没有文字层)——不送 LLM 判决,先解决抽取,不是判决逻辑的问题")
                continue
            body = text[text.find("总则"):] if "总则" in text else text
            doc = run_verdict_from_text(body[:5000], archive=False)
        except Exception as e:  # noqa: BLE001
            print(f"❌ {sp.name}: 跑挂 {type(e).__name__}: {e}")
            any_fail = True
            continue
        items = doc.get("items") or []
        cited = sum(1 for it in items if it.get("basis_verified"))
        fails = _check(sp.name, doc)
        status = "✅" if not fails else "❌"
        print(f"{status} {sp.name}: light={doc.get('light')} grounded={doc['provenance']['rag_grounded']} "
              f"| {len(items)} 项,{cited} 条可核引证")
        for f in fails:
            print(f"     ↳ 退步:{f}")
        any_fail = any_fail or bool(fails)
    print("\n" + ("有样本退步,请查判决逻辑" if any_fail else "全部通过,判决质量未退步 ✅"))
    return 1 if any_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
