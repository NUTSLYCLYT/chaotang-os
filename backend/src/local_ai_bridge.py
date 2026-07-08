"""Local AI bridge for CourtOS mainline.

This module integrates the local Ollama/genius stack without moving model
weights or the Obsidian vault into this repository. The backend treats them as
external runtime resources:

- /home/ubuntu/local-ai: model runtime and genius controller
- /home/ubuntu/CourtOS-Brain: read-only Shiguan/Obsidian vault input
"""

from __future__ import annotations

import os
import re
import subprocess
import json
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


ALLOWED_PLAY_COMMANDS = frozenset({
    "status",
    "index",
    "search",
    "genius",
    "review",
    "warm",
})


class LocalAIUnavailable(RuntimeError):
    """Raised when the local AI runtime is not installed or not executable."""


@dataclass(frozen=True)
class LocalAIConfig:
    local_ai_root: Path
    courtos_brain_path: Path
    base_url: str = "http://127.0.0.1:11434/v1"
    api_key: str = "ollama"
    main_model: str = "qwen3.6-35b-a3b-q4"
    timeout_sec: int = 180

    @property
    def play_script(self) -> Path:
        return self.local_ai_root / "play.sh"


def config_from_env() -> LocalAIConfig:
    return LocalAIConfig(
        local_ai_root=Path(os.getenv("LOCAL_AI_ROOT", "/home/ubuntu/local-ai")),
        courtos_brain_path=Path(os.getenv("COURTOS_BRAIN_PATH", "/home/ubuntu/CourtOS-Brain")),
        base_url=os.getenv("OPENAI_BASE_URL", "http://127.0.0.1:11434/v1"),
        api_key=os.getenv("OPENAI_API_KEY", "ollama"),
        main_model=os.getenv("LOCAL_AGENT_MODEL", "qwen3.6-35b-a3b-q4"),
        timeout_sec=int(os.getenv("LOCAL_AI_TIMEOUT_SEC", "180")),
    )


def fusion_status(config: LocalAIConfig | None = None) -> dict[str, Any]:
    cfg = config or config_from_env()
    play_script = cfg.play_script
    return {
        "enabled": play_script.exists() and os.access(play_script, os.X_OK),
        "local_ai_root": str(cfg.local_ai_root),
        "play_script": str(play_script),
        "play_script_exists": play_script.exists(),
        "play_script_executable": play_script.exists() and os.access(play_script, os.X_OK),
        "courtos_brain_path": str(cfg.courtos_brain_path),
        "courtos_brain_exists": cfg.courtos_brain_path.exists(),
        "base_url": cfg.base_url,
        "main_model": cfg.main_model,
        "direct_ollama_fallback": True,
        "mode": "external_runtime_readonly_vault",
    }


def build_play_command(command: str, *args: str, config: LocalAIConfig | None = None) -> list[str]:
    if command not in ALLOWED_PLAY_COMMANDS:
        allowed = ", ".join(sorted(ALLOWED_PLAY_COMMANDS))
        raise ValueError(f"local-ai command not allowed: {command!r}; allowed={allowed}")
    cfg = config or config_from_env()
    return [str(cfg.play_script), command, *[str(arg) for arg in args]]


def run_play(command: str, *args: str, config: LocalAIConfig | None = None, timeout_sec: int | None = None) -> dict[str, Any]:
    cfg = config or config_from_env()
    if not cfg.play_script.exists():
        raise LocalAIUnavailable(f"local-ai play script not found: {cfg.play_script}")
    if not os.access(cfg.play_script, os.X_OK):
        raise LocalAIUnavailable(f"local-ai play script is not executable: {cfg.play_script}")

    env = os.environ.copy()
    env.update({
        "OPENAI_BASE_URL": cfg.base_url,
        "OPENAI_API_KEY": cfg.api_key,
        "LOCAL_AGENT_MODEL": cfg.main_model,
    })
    proc = subprocess.run(
        build_play_command(command, *args, config=cfg),
        cwd=str(cfg.local_ai_root),
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout_sec or cfg.timeout_sec,
        check=False,
    )
    return {
        "command": command,
        "args": list(args),
        "returncode": proc.returncode,
        "stdout": proc.stdout.strip(),
        "stderr": proc.stderr.strip(),
        "ok": proc.returncode == 0,
    }


def _clean_model_output(content: str) -> str:
    content = (content or "").strip()
    content = re.sub(r"(?s)<think>.*?</think>\s*", "", content).strip()
    if content.startswith("<think>"):
        return ""
    return content


def direct_chat(query: str, *, review: bool = False, config: LocalAIConfig | None = None) -> dict[str, Any]:
    """Call the OpenAI-compatible local model endpoint without local-ai scripts."""
    cfg = config or config_from_env()
    system = (
        "你是 CourtOS 后端主线内置的本地 AI fallback。"
        "回答必须直接、可执行、中文优先，不暴露隐藏推理。"
    )
    if review:
        system += " 你要进行二审：指出风险、修正结论，并给出更稳的最终答案。"
    prompt = query.strip()
    if "qwen3.6" in cfg.main_model.lower() and "/no_think" not in prompt:
        prompt = "/no_think\n" + prompt
    payload = {
        "model": cfg.main_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "temperature": 0.2,
        "max_tokens": 1536,
    }
    req = urllib.request.Request(
        cfg.base_url.rstrip("/") + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cfg.api_key}",
        },
    )
    with urllib.request.urlopen(req, timeout=cfg.timeout_sec) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    output = _clean_model_output(data["choices"][0]["message"]["content"])
    return {
        "command": "direct-review" if review else "direct-genius",
        "args": [query],
        "returncode": 0 if output else 1,
        "stdout": output,
        "stderr": "" if output else "model returned empty final answer",
        "ok": bool(output),
        "fallback": "direct_ollama_openai_compatible",
    }


def index_courtos_brain(config: LocalAIConfig | None = None) -> dict[str, Any]:
    cfg = config or config_from_env()
    if not cfg.courtos_brain_path.exists():
        raise LocalAIUnavailable(f"CourtOS-Brain vault not found: {cfg.courtos_brain_path}")
    return run_play("index", str(cfg.courtos_brain_path), config=cfg, timeout_sec=max(cfg.timeout_sec, 300))


def ask_genius(query: str, *, review: bool = False, config: LocalAIConfig | None = None) -> dict[str, Any]:
    query = query.strip()
    if not query:
        raise ValueError("query is required")
    cfg = config or config_from_env()
    if cfg.play_script.exists() and os.access(cfg.play_script, os.X_OK):
        return run_play("review" if review else "genius", query, config=cfg)
    return direct_chat(query, review=review, config=cfg)


def _read_frontmatter(path: Path) -> dict[str, str]:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 4)
    if end < 0:
        return {}
    out: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        out[key.strip()] = value.strip()
    return out


def _collect_wiki_backlinks(wiki_dir: Path) -> set[str]:
    backlinks: set[str] = set()
    sources_dir = wiki_dir / "sources"
    if not sources_dir.exists():
        return backlinks
    for source in sources_dir.glob("*.md"):
        try:
            text = source.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for match in re.finditer(r"\[\[(concepts/[^\]]+|entities/[^\]]+)\]\]", text):
            backlinks.add(match.group(1))
    return backlinks


def audit_courtos_brain(config: LocalAIConfig | None = None) -> dict[str, Any]:
    """Read-only health audit for the CourtOS-Brain LLM-Wiki layer."""
    cfg = config or config_from_env()
    vault = cfg.courtos_brain_path
    wiki = vault / "_wiki"
    if not vault.exists():
        raise LocalAIUnavailable(f"CourtOS-Brain vault not found: {vault}")
    if not wiki.exists():
        return {
            "ok": False,
            "vault": str(vault),
            "error": f"no _wiki dir at {wiki}",
        }

    sources = list((wiki / "sources").glob("*.md")) if (wiki / "sources").exists() else []
    concepts = list((wiki / "concepts").glob("**/*.md")) if (wiki / "concepts").exists() else []
    entities = list((wiki / "entities").glob("**/*.md")) if (wiki / "entities").exists() else []
    themes = list((wiki / "themes").glob("**/*.md")) if (wiki / "themes").exists() else []

    backlinks = _collect_wiki_backlinks(wiki)

    stale_sources: list[dict[str, str]] = []
    duplicate_paths: dict[str, list[str]] = {}
    for source in sources:
        fm = _read_frontmatter(source)
        raw_path = fm.get("raw_path", "")
        if raw_path:
            duplicate_paths.setdefault(raw_path, []).append(source.name)
        if not raw_path or raw_path.startswith(("openclaw://", "qna://")):
            continue
        if not Path(raw_path).exists():
            stale_sources.append({"source": source.name, "raw_path": raw_path})

    orphan_concepts = [
        concept.stem
        for concept in concepts
        if f"concepts/{concept.stem}" not in backlinks
    ]
    orphan_entities: list[str] = []
    entities_dir = wiki / "entities"
    for entity in entities:
        try:
            key = f"entities/{entity.relative_to(entities_dir).with_suffix('').as_posix()}"
        except ValueError:
            key = f"entities/{entity.stem}"
        if key not in backlinks:
            orphan_entities.append(key.removeprefix("entities/"))

    duplicate_sources = {
        raw_path: names for raw_path, names in duplicate_paths.items() if len(names) > 1
    }

    concept_stubs = sum(1 for item in concepts if _read_frontmatter(item).get("status") == "stub")
    entity_stubs = sum(1 for item in entities if _read_frontmatter(item).get("status") == "stub")
    blockers = []
    if stale_sources:
        blockers.append("stale_sources")
    if duplicate_sources:
        blockers.append("duplicate_sources")

    return {
        "ok": not blockers,
        "vault": str(vault),
        "audited_at": datetime.now().isoformat(timespec="seconds"),
        "counts": {
            "sources": len(sources),
            "concepts": len(concepts),
            "entities": len(entities),
            "themes": len(themes),
            "concept_stubs": concept_stubs,
            "entity_stubs": entity_stubs,
        },
        "blockers": blockers,
        "stale_sources": stale_sources[:50],
        "orphan_concepts": orphan_concepts[:50],
        "orphan_entities": orphan_entities[:50],
        "duplicate_sources": {k: v for k, v in list(duplicate_sources.items())[:20]},
        "mode": "readonly",
    }
