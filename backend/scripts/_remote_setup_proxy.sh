#!/bin/bash
set -e
cd /opt/jiqun_ai

echo "=== 1. Patch providers.yaml: litellm_proxy → remote URL + glm-5 ==="
.venv/bin/python - <<'PY'
import yaml
from pathlib import Path

p = Path("config/providers.yaml")
cfg = yaml.safe_load(p.read_text(encoding="utf-8"))

prov = cfg["providers"]["litellm_proxy"]
prov["api_base"] = "https://mypc.struggleyou.top/litellm/v1"
prov["default_model"] = "openai/glm-5"
# Ensure all listed models are real ones on the remote proxy
prov["models"] = [
    "openai/glm-4.5-air",
    "openai/glm-4.7",
    "openai/glm-5",
    "openai/glm-5-turbo",
]

cfg["active"] = "litellm_proxy"

# Also update all model_tiers that currently point at 127.0.0.1:4444 so step-level
# tier references work without proxy hopping
for tier_name, tier in (cfg.get("model_tiers") or {}).items():
    if isinstance(tier, dict) and tier.get("api_base", "").startswith("http://127.0.0.1:4444"):
        tier["api_base"] = "https://mypc.struggleyou.top/litellm/v1"
        # map swarm-* model names to glm-5 (or glm-4.7 for heavier)
        m = tier.get("model", "")
        if "swarm-quick" in m or "swarm-review" in m:
            tier["model"] = "openai/glm-4.5-air"
        elif "swarm-worker" in m or "swarm-strong" in m:
            tier["model"] = "openai/glm-5"
        elif "claude" in m:
            tier["model"] = "openai/glm-5"

p.write_text(yaml.dump(cfg, allow_unicode=True, default_flow_style=False, sort_keys=False), encoding="utf-8")
print("providers.yaml patched.")
PY

echo
echo "=== 2. Patch flow_evaluate.yaml: replace swarm-* with glm-* ==="
.venv/bin/python - <<'PY'
import yaml
from pathlib import Path

p = Path("config/flow_evaluate.yaml")
cfg = yaml.safe_load(p.read_text(encoding="utf-8"))

# Top-level
cfg["default_model"] = "openai/glm-5"
cfg["default_api_base"] = "https://mypc.struggleyou.top/litellm/v1"
cfg["default_api_key_env"] = "LITELLM_PROXY_KEY"

# Step-level overrides
for st in cfg.get("steps", []):
    m = st.get("model", "")
    if m.startswith("openai/swarm-"):
        st["model"] = "openai/glm-5"

p.write_text(yaml.dump(cfg, allow_unicode=True, default_flow_style=False, sort_keys=False), encoding="utf-8")
print("flow_evaluate.yaml patched.")
PY

echo
echo "=== 3. Show effective config ==="
head -10 config/flow_evaluate.yaml
echo "---"
.venv/bin/python -c "from src.provider import get_active_provider; import json; print(json.dumps(get_active_provider(), indent=2, ensure_ascii=False))"
