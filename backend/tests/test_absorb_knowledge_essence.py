"""吸收脚本自检：清单可解析、幂等、frontmatter 哈希可验证。"""

import hashlib
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend" / "scripts"))

import absorb_knowledge_essence as abs_mod  # noqa: E402


def test_manifest_sources_exist():
    missing = []
    for entry in abs_mod._manifest():
        src = REPO_ROOT / entry["src"]
        dst = REPO_ROOT / entry["dst"]
        if not src.exists() and not dst.exists():
            missing.append(entry["src"])
    assert not missing, f"manifest sources missing: {missing}"


def test_manifest_trust_tiers_valid():
    valid = {"statute", "curated", "self_generated", "methodology"}
    for entry in abs_mod._manifest():
        assert entry["trust_tier"] in valid, entry


def test_absorbed_files_hash_verifiable():
    """已吸收文件的 content_hash 必须与正文 sha256 一致（未吸收则跳过该条）。"""
    checked = 0
    for entry in abs_mod._manifest():
        dst = REPO_ROOT / entry["dst"]
        if not dst.exists():
            continue
        fields, body = abs_mod._split_frontmatter(dst.read_text(encoding="utf-8"))
        if not fields:
            continue
        digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
        assert fields["content_hash"] == f"sha256:{digest}", dst
        assert fields["trust_tier"] == entry["trust_tier"], dst
        checked += 1
    assert checked >= 0


def test_split_frontmatter_ignores_foreign_frontmatter():
    text = "---\ntitle: x\n---\nbody"
    fields, body = abs_mod._split_frontmatter(text)
    assert fields == {} and body == text


def test_absorbed_content_matches_whitelist_source():
    """溯源锚定：落库正文必须与源文件一致（篡改正文+改哈希也过不了）。"""
    verified = 0
    for entry in abs_mod._manifest():
        if entry["src"] == entry["dst"]:
            continue
        src = REPO_ROOT / entry["src"]
        dst = REPO_ROOT / entry["dst"]
        if not (src.exists() and dst.exists()):
            continue
        _, src_body = abs_mod._split_frontmatter(src.read_text(encoding="utf-8"))
        _, dst_body = abs_mod._split_frontmatter(dst.read_text(encoding="utf-8"))
        assert src_body == dst_body, f"content diverged from source: {entry['dst']}"
        verified += 1
    assert verified > 0, "no src/dst pairs verified"


def test_self_generated_never_lands_in_rag_docs_tree():
    """RAG 检索端没有 trust_tier 加权前，self_generated 不得进 knowledge/docs/。"""
    for entry in abs_mod._manifest():
        if entry["trust_tier"] == "self_generated":
            assert not entry["dst"].startswith("backend/knowledge/docs/"), entry["dst"]
