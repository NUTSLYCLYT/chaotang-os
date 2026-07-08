import json
from pathlib import Path

import pytest

from src.local_ai_bridge import (
    LocalAIConfig,
    ask_genius,
    audit_courtos_brain,
    build_play_command,
    fusion_status,
)


def test_local_ai_bridge_status_keeps_runtime_external(tmp_path: Path) -> None:
    local_ai = tmp_path / "local-ai"
    local_ai.mkdir()
    play = local_ai / "play.sh"
    play.write_text("#!/usr/bin/env bash\n", encoding="utf-8")
    play.chmod(0o755)
    vault = tmp_path / "CourtOS-Brain"
    vault.mkdir()

    status = fusion_status(LocalAIConfig(local_ai_root=local_ai, courtos_brain_path=vault))

    assert status["enabled"] is True
    assert status["mode"] == "external_runtime_readonly_vault"
    assert status["local_ai_root"] == str(local_ai)
    assert status["courtos_brain_path"] == str(vault)


def test_build_play_command_uses_argv_not_shell(tmp_path: Path) -> None:
    local_ai = tmp_path / "local-ai"
    local_ai.mkdir()
    cfg = LocalAIConfig(local_ai_root=local_ai, courtos_brain_path=tmp_path / "vault")

    command = build_play_command("search", "Genius system design", config=cfg)

    assert command == [str(local_ai / "play.sh"), "search", "Genius system design"]


def test_build_play_command_rejects_unapproved_commands(tmp_path: Path) -> None:
    cfg = LocalAIConfig(local_ai_root=tmp_path, courtos_brain_path=tmp_path / "vault")

    with pytest.raises(ValueError, match="not allowed"):
        build_play_command("stop", config=cfg)


def test_audit_courtos_brain_reports_wiki_health_without_writes(tmp_path: Path) -> None:
    vault = tmp_path / "CourtOS-Brain"
    source_raw = vault / "01-Daily-Briefings" / "today.md"
    source_raw.parent.mkdir(parents=True)
    source_raw.write_text("# Today\n", encoding="utf-8")
    wiki = vault / "_wiki"
    (wiki / "sources").mkdir(parents=True)
    (wiki / "concepts").mkdir(parents=True)
    (wiki / "entities" / "tool").mkdir(parents=True)
    (wiki / "sources" / "today.md").write_text(
        f"""---
raw_path: {source_raw}
---

## Concepts

- [[concepts/local-ai]]
- [[entities/tool/ollama]]
""",
        encoding="utf-8",
    )
    (wiki / "concepts" / "local-ai.md").write_text(
        "---\nstatus: stub\n---\n# local-ai\n",
        encoding="utf-8",
    )
    (wiki / "entities" / "tool" / "ollama.md").write_text(
        "---\nstatus: stub\n---\n# ollama\n",
        encoding="utf-8",
    )

    result = audit_courtos_brain(LocalAIConfig(local_ai_root=tmp_path, courtos_brain_path=vault))

    assert result["ok"] is True
    assert result["mode"] == "readonly"
    assert result["counts"]["sources"] == 1
    assert result["counts"]["concepts"] == 1
    assert result["counts"]["entities"] == 1
    assert result["counts"]["concept_stubs"] == 1
    assert result["stale_sources"] == []
    assert result["orphan_concepts"] == []
    assert result["orphan_entities"] == []


def test_ask_genius_falls_back_to_direct_ollama_when_play_script_missing(monkeypatch, tmp_path: Path) -> None:
    class _FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def read(self) -> bytes:
            return json.dumps({
                "choices": [
                    {"message": {"content": "主线 fallback 正常。"}},
                ],
            }).encode("utf-8")

    captured = {}

    def _fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["timeout"] = timeout
        return _FakeResponse()

    monkeypatch.setattr("urllib.request.urlopen", _fake_urlopen)
    cfg = LocalAIConfig(
        local_ai_root=tmp_path / "missing-local-ai",
        courtos_brain_path=tmp_path / "vault",
        base_url="http://127.0.0.1:11434/v1",
        main_model="qwen3.6-35b-a3b-q4",
    )

    result = ask_genius("检查主线是否能 fallback", config=cfg)

    assert result["ok"] is True
    assert result["stdout"] == "主线 fallback 正常。"
    assert result["fallback"] == "direct_ollama_openai_compatible"
    assert captured["url"] == "http://127.0.0.1:11434/v1/chat/completions"
