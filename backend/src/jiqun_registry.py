"""Unified jiqun_ai architecture registry loader.

This module is intentionally configuration-first: flow YAML files still define
runtime behavior, while config/jiqun_registry.yaml defines system boundaries,
runtime policy, and the relationship between swarms, manors, critics, and
persona reviewers.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
RUNTIME_PROMPTS_DIR = ROOT / "runtime_prompts"


@dataclass(frozen=True)
class RegistryIssue:
    level: str
    message: str
    ref: str = ""


def _load_yaml(path: Path) -> dict[str, Any]:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a YAML mapping")
    return data


class JiqunRegistry:
    """Read and validate the jiqun_ai architecture registry."""

    def __init__(
        self,
        registry_path: str | Path | None = None,
        *,
        root: Path = ROOT,
    ) -> None:
        self.root = root
        self.registry_path = Path(registry_path) if registry_path else root / "config" / "jiqun_registry.yaml"
        if not self.registry_path.is_absolute():
            self.registry_path = root / self.registry_path
        self._registry = _load_yaml(self.registry_path)

    @property
    def data(self) -> dict[str, Any]:
        return self._registry

    def load_review_committee(self) -> dict[str, Any]:
        path = self._resolve_config_ref(self._registry["system"]["review_committee"])
        return _load_yaml(path)

    def load_global_tail_flow(self) -> dict[str, Any]:
        path = self._resolve_config_ref(self._registry["system"]["global_tail_flow"])
        return _load_yaml(path)

    def _resolve_config_ref(self, ref: str) -> Path:
        path = Path(ref)
        if not path.is_absolute():
            path = self.root / path
        return path

    def swarms(self) -> list[dict[str, Any]]:
        return list(self._registry.get("swarms", []))

    def swarm(self, swarm_id: str) -> dict[str, Any] | None:
        for swarm in self.swarms():
            if swarm.get("id") == swarm_id:
                return swarm
        return None

    def list_agents(self, *, include_personas: bool = True) -> list[dict[str, Any]]:
        """Return registered runtime agents plus persona reviewers.

        The same prompt_key can appear in multiple swarms; each row keeps the
        swarm context so callers can answer "where is this agent used?"
        """
        agents: list[dict[str, Any]] = []
        for swarm in self.swarms():
            for prompt_key in swarm.get("agents", []):
                agents.append({
                    "agent_id": prompt_key,
                    "name": prompt_key,
                    "kind": "subagent",
                    "runtime": swarm.get("runtime", "subagent"),
                    "swarm_id": swarm.get("id"),
                    "swarm_name": swarm.get("name"),
                    "category": swarm.get("category"),
                    "prompt_path": self._prompt_path_for(prompt_key),
                    "config": swarm.get("config"),
                })

        if include_personas:
            committee = self.load_review_committee()
            for persona in committee.get("personas", []):
                agents.append({
                    "agent_id": persona.get("id"),
                    "name": persona.get("name"),
                    "kind": "persona_reviewer",
                    "runtime": committee.get("runtime", "subagent"),
                    "role": persona.get("role"),
                    "skill_path": persona.get("skill_path"),
                    "committee_id": committee.get("committee_id"),
                })
        return agents

    def list_manor_groups(self) -> list[dict[str, Any]]:
        manor_ref = self._registry["system"]["manor_groups"]
        path = self._resolve_config_ref(manor_ref)
        data = _load_yaml(path)
        return list(data.get("groups", []))

    def runtime_policy(self) -> dict[str, Any]:
        return dict(self._registry.get("runtime_policy", {}))

    def validate(self) -> list[RegistryIssue]:
        issues: list[RegistryIssue] = []

        for key in (
            "court_entry",
            "swarm_orchestrator",
            "manor_groups",
            "review_committee",
            "global_tail_flow",
        ):
            ref = self._registry.get("system", {}).get(key)
            if not ref:
                issues.append(RegistryIssue("error", f"system.{key} is required", key))
                continue
            path = self._resolve_config_ref(ref)
            if not path.exists():
                issues.append(RegistryIssue("error", f"missing config file: {ref}", key))

        seen: set[str] = set()
        for swarm in self.swarms():
            sid = swarm.get("id", "")
            if not sid:
                issues.append(RegistryIssue("error", "swarm id is required"))
                continue
            if sid in seen:
                issues.append(RegistryIssue("error", f"duplicate swarm id: {sid}", sid))
            seen.add(sid)

            config_ref = swarm.get("config", "")
            if not config_ref:
                issues.append(RegistryIssue("error", f"{sid} missing config", sid))
            elif not self._resolve_config_ref(config_ref).exists():
                issues.append(RegistryIssue("error", f"{sid} config missing: {config_ref}", sid))

            for prompt_key in swarm.get("agents", []):
                prompt_dir = self.root / "runtime_prompts" / prompt_key
                if prompt_dir.exists():
                    continue
                # IMA and Court prompts are module-backed today. Keep this as
                # a warning so the registry can describe both prompt sources.
                issues.append(
                    RegistryIssue(
                        "warning",
                        f"{sid}.{prompt_key} has no runtime_prompts directory; likely module-backed",
                        f"{sid}.{prompt_key}",
                    )
                )

        committee = self.load_review_committee()
        for persona in committee.get("personas", []):
            skill_path = persona.get("skill_path")
            if skill_path and not (self.root / skill_path).exists():
                issues.append(
                    RegistryIssue(
                        "warning",
                        f"persona skill path missing: {skill_path}",
                        persona.get("id", ""),
                    )
                )

        return issues

    def _prompt_path_for(self, prompt_key: str) -> str | None:
        path = self.root / "runtime_prompts" / prompt_key
        if path.exists():
            return str(path.relative_to(self.root))
        return None


def load_registry() -> dict[str, Any]:
    return JiqunRegistry().data


def validate_registry() -> list[RegistryIssue]:
    return JiqunRegistry().validate()
