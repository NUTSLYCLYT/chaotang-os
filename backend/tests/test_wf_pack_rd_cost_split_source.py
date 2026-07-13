from pathlib import Path


SOURCE = (Path(__file__).resolve().parents[1] / "scripts" / "wf_pack_rd_cost_split.js").read_text(
    encoding="utf-8"
)


def test_workflow_resolves_repository_from_the_canonical_backend_script_location() -> None:
    assert "fileURLToPath(new URL('..', import.meta.url))" in SOURCE
    assert "/home/ubuntu/fe/" not in SOURCE
    assert "jiqun_ai_fresh" not in SOURCE
