"""一次性吸收外仓知识精华，带 K0A 溯源 frontmatter。

设计约束(2026-07-14 用户批准的吸收方案):
- 只吸收人工裁决过的白名单(见 MANIFEST)，不做全量搬运;
- 每篇落库文档头部写 provenance frontmatter: source_id / source_path /
  content_hash / trust_tier / k0a_snapshot_token / absorbed_at;
- content_hash = 原文(不含 frontmatter)的 sha256，重跑天然幂等;
- trust_tier: statute(检索加权) | curated | self_generated(降权) | methodology(不入 RAG)。

用法: python3 backend/scripts/absorb_knowledge_essence.py [--check]
--check 只校验已吸收文件的 frontmatter 与哈希，不写入。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
K0A_MANIFEST = (
    REPO_ROOT
    / ".harness/changes/chore-knowledge-resource-inventory-k0a-20260714"
    / "artifacts/knowledge-resource-inventory.json"
)
ABSORBED_AT = "2026-07-14"

_LAWYERS = ["contract", "compliance", "ip", "labor", "litigation", "privacy"]
_BATTERY_DOCS = [
    "battery_prices_reference.md",
    "industry_standards.md",
    "low_temp_battery_guide.md",
    "low_temp_charging_risk_analysis.md",
    "low_temp_starter_power_spec.md",
    "market_agv_battery_sales_reply.md",
]
_XIANHU_PUBLISHED = [
    "铭硕_储能165GWh隐性门槛_发布版.md",
    "铭硕_军民融合技术下放_发布版.md",
    "铭硕_宁德-21℃门槛_发布版.md",
    "铭硕_换电重卡经济账_发布版.md",
    "铭硕_极寒商用车_发布版.md",
    "铭硕_钠电锂硫站位_发布版.md",
    "铭硕_锂硫耐超低温科普_发布版.md",
]


def _manifest() -> list[dict]:
    entries: list[dict] = []
    for name in _LAWYERS:
        entries.append(
            {
                "src": f"skills/personas/{name}-lawyer/references/statutes.md",
                "dst": f"backend/knowledge/docs/legal/{name}-statutes.md",
                "source_id": "legal_statutes",
                "trust_tier": "statute",
            }
        )
    for name in _BATTERY_DOCS:
        entries.append(
            {
                "src": f"backend/knowledge/docs/{name}",
                "dst": f"backend/knowledge/docs/{name}",
                "source_id": "ima_docs",
                "trust_tier": "curated",
            }
        )
    entries.append(
        {
            "src": "courtos-brain/03-Outputs/2026-07-13-GitHub第29周AI-Agent落地指南.md",
            "dst": "backend/knowledge/docs/decisions/2026-07-13-github-week29-ai-agent-guide.md",
            "source_id": "repo_archive",
            "trust_tier": "curated",
        }
    )
    for name in _XIANHU_PUBLISHED:
        entries.append(
            {
                # ponytail: self_generated 不入 RAG 树(docs/)——检索端没有 trust_tier
                # 加权前,营销稿与法条平权入库是污染;加权落地后再迁回 docs/marketing/
                "src": f"courtos-brain/06-Chaotang-Xianhu/content/{name}",
                "dst": f"backend/knowledge/marketing_selfgen/{name}",
                "source_id": "repo_archive",
                "trust_tier": "self_generated",
            }
        )
    for src, dst in [
        ("courtos-brain/VAULT-GUIDE.md", "docs/knowledge-architecture/vault-guide.md"),
        ("courtos-brain/知识库控制台.md", "docs/knowledge-architecture/knowledge-console.md"),
    ]:
        entries.append(
            {"src": src, "dst": dst, "source_id": "repo_archive", "trust_tier": "methodology"}
        )
    workflows = REPO_ROOT / "courtos-brain/vault-workflows"
    if workflows.is_dir():
        for fp in sorted(workflows.rglob("*.md")):
            rel = fp.relative_to(REPO_ROOT)
            entries.append(
                {
                    "src": str(rel),
                    "dst": f"docs/knowledge-architecture/vault-workflows/{fp.name}",
                    "source_id": "repo_archive",
                    "trust_tier": "methodology",
                }
            )
    return entries


def _snapshot_tokens() -> dict[str, str]:
    if not K0A_MANIFEST.exists():
        return {}
    data = json.loads(K0A_MANIFEST.read_text(encoding="utf-8"))
    return {s["source_id"]: s.get("snapshot_token", "unknown") for s in data.get("sources", [])}


def _split_frontmatter(text: str) -> tuple[dict, str]:
    """返回(已有的吸收 frontmatter 字段, 正文)。非本脚本写的 frontmatter 视为正文。"""
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    header = text[4:end]
    if "absorbed_at:" not in header:
        return {}, text
    fields = {}
    for line in header.splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip()] = value.strip()
    return fields, text[end + 5 :]


def _frontmatter(entry: dict, body_hash: str, token: str) -> str:
    return (
        "---\n"
        f"source_id: {entry['source_id']}\n"
        f"source_path: {entry['src']}\n"
        f"content_hash: sha256:{body_hash}\n"
        f"trust_tier: {entry['trust_tier']}\n"
        f"k0a_snapshot_token: {token}\n"
        f"absorbed_at: {ABSORBED_AT}\n"
        "---\n"
    )


def run(check_only: bool = False) -> int:
    tokens = _snapshot_tokens()
    errors: list[str] = []
    written = skipped = 0
    for entry in _manifest():
        src = REPO_ROOT / entry["src"]
        dst = REPO_ROOT / entry["dst"]
        if not src.exists() and not dst.exists():
            errors.append(f"missing source: {entry['src']}")
            continue
        raw = (dst if dst.exists() else src).read_text(encoding="utf-8")
        existing, body = _split_frontmatter(raw)
        body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
        if existing:
            if existing.get("content_hash") != f"sha256:{body_hash}":
                errors.append(f"hash mismatch vs own body: {entry['dst']}")
            elif entry["src"] != entry["dst"] and src.exists():
                # 溯源锚定：落库正文必须与白名单源文件逐字节一致，
                # 防止"改正文再改哈希"绕过校验
                _, src_body = _split_frontmatter(src.read_text(encoding="utf-8"))
                src_hash = hashlib.sha256(src_body.encode("utf-8")).hexdigest()
                if src_hash != body_hash:
                    errors.append(f"content diverged from source: {entry['dst']}")
                else:
                    skipped += 1
            else:
                skipped += 1
            continue
        if check_only:
            errors.append(f"not absorbed yet: {entry['dst']}")
            continue
        token = tokens.get(entry["source_id"], "unknown")
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(_frontmatter(entry, body_hash, token) + body, encoding="utf-8")
        written += 1
    print(f"absorbed={written} already_ok={skipped} errors={len(errors)}")
    for err in errors:
        print(f"  ERROR {err}", file=sys.stderr)
    return 1 if errors else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    return run(check_only=args.check)


if __name__ == "__main__":
    raise SystemExit(main())
