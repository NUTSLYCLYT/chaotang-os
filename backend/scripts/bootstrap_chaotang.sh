#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${FENGQUN_WEB_PORT:-8081}"
VENV_DIR="${VENV_DIR:-.venv}"

echo "[1/6] preparing Python virtualenv: $VENV_DIR"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

PY="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

echo "[2/6] upgrading pip and installing dependencies"
"$PY" -m pip install --upgrade pip
if [ -f requirements-core.txt ]; then
  "$PIP" install -r requirements-core.txt
fi
if [ -f requirements-optional.txt ]; then
  "$PIP" install -r requirements-optional.txt
fi
if [ -f requirements-test.txt ]; then
  "$PIP" install -r requirements-test.txt
fi

echo "[3/6] checking local provider config"
if [ ! -f config/providers.yaml ]; then
  cat > config/providers.yaml <<'YAML'
providers:
  default:
    provider: "mock"
    model: "mock"

# Replace this local placeholder with your own provider config.
# Common environment variables:
# - OPENAI_API_KEY
# - DEEPSEEK_API_KEY
# - ZHIPU_API_KEY
# - DASHSCOPE_API_KEY
YAML
  echo "created config/providers.yaml placeholder; edit it before real model calls"
else
  echo "config/providers.yaml exists; leaving user config unchanged"
fi

echo "[4/6] running commercial-loop smoke tests"
"$PY" -m pytest -q \
  tests/test_commercial_loop_dashboard_api.py \
  tests/test_web_index_resource_profile.py \
  tests/test_commercial_loop_harness.py

echo "[5/6] running harness dry-run"
"$PY" harness/chaotang-commercial-loop/scripts/run_harness.py \
  --dry-run \
  --case-id cold_storage_100mwh \
  --blocks opc \
  --no-write-ledger \
  --no-write-events \
  --no-write-business \
  --no-write-golden-candidates

echo "[6/6] starting Chaotang Web on http://127.0.0.1:$PORT"
echo "Stop with Ctrl-C. Set FENGQUN_WEB_PORT to change the port."
mkdir -p harness/chaotang-commercial-loop/artifacts
export FENGQUN_COMMERCIAL_BUSINESS_LEDGER="${FENGQUN_COMMERCIAL_BUSINESS_LEDGER:-$ROOT_DIR/harness/chaotang-commercial-loop/artifacts/commercial_loop_business.jsonl}"
export FENGQUN_COMMERCIAL_GOLDEN_CANDIDATES="${FENGQUN_COMMERCIAL_GOLDEN_CANDIDATES:-$ROOT_DIR/harness/chaotang-commercial-loop/artifacts/commercial_loop_golden_candidates.jsonl}"
export FENGQUN_COMMERCIAL_EVENTS="${FENGQUN_COMMERCIAL_EVENTS:-$ROOT_DIR/harness/chaotang-commercial-loop/artifacts/commercial_loop_events.jsonl}"
export FENGQUN_COMMERCIAL_FAILURES="${FENGQUN_COMMERCIAL_FAILURES:-$ROOT_DIR/harness/chaotang-commercial-loop/artifacts/commercial_loop_failures.jsonl}"
export FENGQUN_COMMERCIAL_GOLDEN_CASES="${FENGQUN_COMMERCIAL_GOLDEN_CASES:-$ROOT_DIR/harness/chaotang-commercial-loop/artifacts/commercial_loop_promoted_cases.json}"
if [ -z "${FENGQUN_JWT_SECRET:-}" ]; then
  export FENGQUN_JWT_SECRET="$("$PY" - <<'PY'
import secrets
print(secrets.token_urlsafe(32))
PY
)"
  echo "generated an ephemeral FENGQUN_JWT_SECRET for this local process"
fi
export FENGQUN_WEB_PORT="$PORT"
"$PY" -m web.main
