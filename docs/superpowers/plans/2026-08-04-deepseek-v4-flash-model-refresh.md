# DeepSeek v4 Flash Model Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore authenticated Chancellor draft generation by selecting the user-approved `deepseek-v4-flash` model and proving the live model remains available.

**Architecture:** Keep the existing DeepSeek client, `openai/` normalization, draft graph, and HTTP contracts unchanged. Update only the provider configuration and its source-of-truth contract test, then restart the single local backend and verify the authenticated end-to-end flow.

**Tech Stack:** Python 3.14, pytest, YAML, OpenAI-compatible DeepSeek API, FastAPI/Uvicorn, Node harness.

## Global Constraints

- Preserve ADR 0028 without modification.
- Default model is exactly `openai/deepseek-v4-flash`.
- Declared models are exactly `openai/deepseek-v4-flash` and `openai/deepseek-v4-pro`.
- Do not add automatic fallback, provider selection, dependencies, or secret values.
- Preserve all unrelated working-tree changes.
- Do not commit, push, deploy, or publish without separate explicit authorization.
- The final unchanged version must pass the complete acceptance flow 10 consecutive times; any failure or material change resets the count to 1.

---

### Task 1: Lock the approved provider configuration with TDD

**Files:**
- Modify: `backend/tests/test_deepseek_config.py`
- Modify: `backend/config/providers.yaml`

**Interfaces:**
- Consumes: `load_deepseek_provider_config() -> DeepSeekProviderConfig`
- Produces: default model `openai/deepseek-v4-flash` and models tuple `("openai/deepseek-v4-flash", "openai/deepseek-v4-pro")`

- [ ] **Step 1: Change the real-config assertions before changing YAML**

```python
def test_load_real_providers_yaml_with_active_deepseek_succeeds():
    config = load_deepseek_provider_config()

    assert config.base_url == "https://api.deepseek.com/v1"
    assert config.api_key_env == "DEEPSEEK_API_KEY"
    assert config.default_model == "openai/deepseek-v4-flash"
    assert config.models == (
        "openai/deepseek-v4-flash",
        "openai/deepseek-v4-pro",
    )
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest -q backend\tests\test_deepseek_config.py::test_load_real_providers_yaml_with_active_deepseek_succeeds
```

Expected: FAIL showing actual `openai/deepseek-chat` differs from expected `openai/deepseek-v4-flash`.

- [ ] **Step 3: Apply the minimal provider configuration change**

```yaml
    default_model: openai/deepseek-v4-flash
    models:
      - openai/deepseek-v4-flash
      - openai/deepseek-v4-pro
```

- [ ] **Step 4: Run the focused test and full DeepSeek configuration tests**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest -q backend\tests\test_deepseek_config.py
```

Expected: all tests PASS.

- [ ] **Step 5: Review only the intended diff**

Run:

```powershell
git diff -- backend/config/providers.yaml backend/tests/test_deepseek_config.py
```

Expected: only the default/allowed model values and matching assertions change. Do not commit without separate authorization.

### Task 2: Record the recurring false-green failure

**Files:**
- Create: `docs/failures/2026-08-04-deepseek-model-availability-drift.md`

**Interfaces:**
- Consumes: observed live 502, successful `/models` authentication, unavailable configured model
- Produces: failure memory with `Summary`, `Root Cause`, `Prevention`, `Detection`, and `Evidence`

- [ ] **Step 1: Create the failure memory**

The document must state that `deepseek-chat` was configured while the authenticated provider returned only `deepseek-v4-flash` and `deepseek-v4-pro`; health checks and mocked tests passed but did not validate model availability; the initial stale-process diagnosis was insufficient.

- [ ] **Step 2: Verify mandatory headings**

Run:

```powershell
node scripts/check_harness.mjs
```

Expected: PASS, including failure-memory structure checks.

- [ ] **Step 3: Review the documentation diff**

Run:

```powershell
git diff -- docs/failures/2026-08-04-deepseek-model-availability-drift.md
```

Expected: no secrets, raw prompts, session IDs, or unsupported claims. Do not commit without separate authorization.

### Task 3: Restart and verify the live path

**Files:**
- No repository file changes
- Runtime logs: `%TEMP%\chaotang-backend-8000.stdout.log`, `%TEMP%\chaotang-backend-8000.stderr.log`

**Interfaces:**
- Consumes: `backend/config/providers.yaml`, existing `DEEPSEEK_API_KEY`, existing authenticated browser session
- Produces: one healthy Uvicorn listener on `127.0.0.1:8000` using `deepseek-v4-flash`

- [ ] **Step 1: Verify the provider advertises the normalized default model**

Run the existing read-only Python probe using `load_deepseek_provider_config()`, `normalize_deepseek_model_name()`, and `client.models.list()`.

Expected: `configured_model_available: True`; never print the API key.

- [ ] **Step 2: Verify the exact listener before stopping it**

Run `Get-NetTCPConnection -State Listen -LocalPort 8000` and resolve its PID with `Get-CimInstance Win32_Process`. Continue only if the command line is this workspace's `.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.

- [ ] **Step 3: Restart the single backend process**

Stop only the verified PID, confirm port 8000 is free, then use `Start-Process -WindowStyle Hidden` from `backend/` with the same Uvicorn arguments and redirected temporary logs.

- [ ] **Step 4: Run targeted regression**

Run:

```powershell
backend\.venv\Scripts\python.exe -m pytest -q backend\tests\test_deepseek_config.py backend\tests\test_deepseek_client.py backend\tests\test_chancellor_drafts_api.py backend\tests\test_chancellor_draft_graph.py backend\tests\test_chancellor_draft_instructions_loader.py backend\tests\test_chancellor_draft_authority.py backend\tests\test_decree_draft_gate.py
```

Expected: PASS with zero failures.

- [ ] **Step 5: Run repository verification**

Run:

```powershell
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 6: Execute one authenticated real draft**

Use the existing browser session to submit a minimal draft request from `/study`. This is the only generation step and may incur DeepSeek usage.

Expected: HTTP 200 and a UI-visible draft; no `502` line for that request in the new backend stdout log.

### Task 4: Complete the mandatory 10-round final acceptance

**Files:**
- Modify: `docs/product/tasks/2026-08-04-deepseek-v4-flash-model-refresh.md`

**Interfaces:**
- Consumes: unchanged final configuration and the exact acceptance sequence below
- Produces: ten consecutively numbered PASS records with commands, timestamps, and evidence

- [ ] **Step 1: Create the product task from `docs/product/tasks/TEMPLATE.md`**

Set status to `Ready` based on the user's explicit confirmations in this conversation. Restrict allowed paths to the two config/test files, the design and plan, this task file, and the failure memory.

- [ ] **Step 2: Run the complete acceptance sequence for rounds 1 through 10**

For each round, without changing code, configuration, or commands, run the targeted regression command, four harness commands, `git diff --check`, health check, OpenAPI draft-route check, and provider-model availability probe.

Expected: every command in every round PASS. Any failure resets the next successful round to round 1.

- [ ] **Step 3: Record results and self-review**

Record each round's timestamp, exact commands, exit codes, test count, health value, route presence, and model availability in the product task. Confirm no secret, session ID, or raw prompt is present.

- [ ] **Step 4: Report the real-call boundary honestly**

If the one authenticated real draft has not been executed, leave acceptance pending and report that remaining gap. If it returned HTTP 200, record only the status and visible success state, not private content.
