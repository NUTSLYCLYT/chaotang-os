$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runner = Join-Path $PSScriptRoot "run_bureau_tool_use_acceptance.ps1"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("bureau-tool-use-runner-test-" + [guid]::NewGuid())

try {
    if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw "acceptance runner is missing" }

    & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Mode SelfTest -EvidenceRoot $tempRoot
    if (-not $?) { throw "PowerShell runner invocation failed" }
    if ($LASTEXITCODE -ne 0) { throw "runner self-test failed with exit $LASTEXITCODE" }

    $manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $tempRoot "fingerprint-manifest.json") | ConvertFrom-Json
    $summary = Get-Content -Raw -Encoding UTF8 (Join-Path $tempRoot "acceptance-summary.json") | ConvertFrom-Json
    if ($manifest.algorithm -ne "SHA-256") { throw "manifest algorithm mismatch" }
    foreach ($required in @(
        "backend/app/agents/runtime_skills/tool_models.py",
        "backend/tests/test_bureau_tool_models.py",
        "docs/decisions/0037-bureau-agent-controlled-tool-use.md",
        "docs/failures/2026-08-04-tool-authority-drift-audit-false-green.md",
        "docs/superpowers/specs/2026-08-03-bureau-agent-tool-use-design.md",
        "docs/superpowers/plans/2026-08-03-bureau-agent-tool-use.md",
        "docs/product/tasks/2026-08-03-bureau-agent-tool-use.md",
        "scripts/run_bureau_tool_use_acceptance.ps1",
        "scripts/run_bureau_tool_use_acceptance.test.ps1",
        ".github/workflows/harness.yml"
    )) {
        if ($manifest.included_files.path -notcontains $required) { throw "fingerprint missing $required" }
    }
    if ($manifest.excluded_paths -notcontains ".superpowers/sdd/bureau-agent-tool-use-evidence/") { throw "raw evidence exclusion missing" }
    $productNormalization = $manifest.normalized_files | Where-Object path -eq "docs/product/tasks/2026-08-03-bureau-agent-tool-use.md"
    if ($null -eq $productNormalization) { throw "product post-acceptance normalization missing" }
    if ($productNormalization.algorithm -ne "marked-block-normalization-v1") { throw "product normalization algorithm mismatch" }
    if ($productNormalization.markers.Count -ne 13) { throw "product normalization must name exactly 13 mutable blocks" }
    if ($manifest.commands.Count -ne 9) { throw "formal matrix must contain exactly nine commands" }
    $expected = @(
        "python -m pytest backend/tests/test_bureau_tool_models.py backend/tests/test_bureau_tool_registry.py backend/tests/test_bureau_tool_policy.py backend/tests/test_bureau_tool_executor.py backend/tests/test_bureau_tool_handlers.py backend/tests/test_bureau_tool_loop.py backend/tests/test_bureau_tool_use_integration.py -q",
        "python -m pytest backend/tests/test_bureaus_agent.py backend/tests/test_agent_evidence_protocol.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_junjichu_runtime_skill.py backend/tests/test_chancellor_graph.py backend/tests/test_downstream_runtime_skill_compatibility.py -q",
        "python -m ruff check backend/app backend/tests",
        "python -m pytest backend/tests -q",
        "node scripts/check_harness.mjs",
        "node scripts/check_harness.mjs --self-test",
        "node .agents/hooks/check-harness.mjs --self-test",
        "node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test",
        'cmd /d /c "git diff --check 2>&1"'
    )
    for ($i = 0; $i -lt $expected.Count; $i++) {
        if ($manifest.commands[$i].command -cne $expected[$i]) { throw "formal command $($i + 1) mismatch" }
    }
    if ($summary.status -ne "SELF_TEST_PASS" -or $summary.completed_rounds -ne 0) { throw "self-test summary mismatch" }
    if ($summary.formal_round -ne $false) { throw "self-test must be non-formal" }

    $productTask = Join-Path $repoRoot "docs/product/tasks/2026-08-03-bureau-agent-tool-use.md"
    $originalProductTask = [System.IO.File]::ReadAllBytes($productTask)
    $insideRoot = Join-Path $tempRoot "product-inside-mutation"
    $outsideRoot = Join-Path $tempRoot "product-outside-mutation"
    $tamperRoot = Join-Path $tempRoot "product-marker-tamper"
    try {
        $productText = [System.Text.Encoding]::UTF8.GetString($originalProductTask)
        $insideText = $productText.Replace("<!-- ACCEPTANCE-FP-BEGIN:STATUS -->Implemented<!-- ACCEPTANCE-FP-END:STATUS -->", "<!-- ACCEPTANCE-FP-BEGIN:STATUS -->Accepted<!-- ACCEPTANCE-FP-END:STATUS -->")
        $insideText = $insideText.Replace("<!-- ACCEPTANCE-FP-BEGIN:AC-01 -->- [ ]<!-- ACCEPTANCE-FP-END:AC-01 -->", "<!-- ACCEPTANCE-FP-BEGIN:AC-01 -->- [x]<!-- ACCEPTANCE-FP-END:AC-01 -->")
        $insideText = $insideText.Replace("<!-- ACCEPTANCE-FP-END:IMPLEMENTATION -->", "accepted fingerprint evidence`n<!-- ACCEPTANCE-FP-END:IMPLEMENTATION -->")
        [System.IO.File]::WriteAllText($productTask, $insideText, [System.Text.UTF8Encoding]::new($false))
        & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Mode SelfTest -EvidenceRoot $insideRoot
        if (-not $? -or $LASTEXITCODE -ne 0) { throw "inside-marker mutation runner failed" }
        $insideSummary = Get-Content -Raw -Encoding UTF8 (Join-Path $insideRoot "acceptance-summary.json") | ConvertFrom-Json
        if ($insideSummary.frozen_fingerprint -ne $summary.frozen_fingerprint) { throw "marked post-acceptance mutation changed fingerprint" }

        $outsideText = $productText.Replace("Structured proposal/result/status/audit contracts", "Structured proposal/result/status/audit contract text mutation")
        [System.IO.File]::WriteAllText($productTask, $outsideText, [System.Text.UTF8Encoding]::new($false))
        & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Mode SelfTest -EvidenceRoot $outsideRoot
        if (-not $? -or $LASTEXITCODE -ne 0) { throw "outside-marker mutation runner failed" }
        $outsideSummary = Get-Content -Raw -Encoding UTF8 (Join-Path $outsideRoot "acceptance-summary.json") | ConvertFrom-Json
        if ($outsideSummary.frozen_fingerprint -eq $summary.frozen_fingerprint) { throw "unmarked acceptance text mutation did not change fingerprint" }

        $tamperedText = $productText.Replace("<!-- ACCEPTANCE-FP-END:STATUS -->", "")
        [System.IO.File]::WriteAllText($productTask, $tamperedText, [System.Text.UTF8Encoding]::new($false))
        $oldPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Mode SelfTest -EvidenceRoot $tamperRoot 2>$null
        $tamperExit = $LASTEXITCODE
        $ErrorActionPreference = $oldPreference
        if ($tamperExit -eq 0) { throw "marker tamper did not fail closed" }
    } finally {
        [System.IO.File]::WriteAllBytes($productTask, $originalProductTask)
    }

    $failureMemory = Join-Path $repoRoot "docs/failures/2026-08-04-tool-authority-drift-audit-false-green.md"
    $originalFailureMemory = [System.IO.File]::ReadAllBytes($failureMemory)
    $mutationRoot = Join-Path $tempRoot "failure-memory-mutation"
    try {
        [System.IO.File]::AppendAllText($failureMemory, "`n<!-- acceptance-fingerprint-mutation -->`n", [System.Text.UTF8Encoding]::new($false))
        & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Mode SelfTest -EvidenceRoot $mutationRoot
        if (-not $?) { throw "mutation PowerShell runner invocation failed" }
        if ($LASTEXITCODE -ne 0) { throw "mutation runner self-test failed with exit $LASTEXITCODE" }
        $mutationSummary = Get-Content -Raw -Encoding UTF8 (Join-Path $mutationRoot "acceptance-summary.json") | ConvertFrom-Json
        if ($mutationSummary.frozen_fingerprint -eq $summary.frozen_fingerprint) {
            throw "failure memory mutation did not change fingerprint"
        }
    } finally {
        [System.IO.File]::WriteAllBytes($failureMemory, $originalFailureMemory)
    }
    foreach ($record in $summary.command_records) {
        foreach ($field in @("command", "exit_code", "started_at", "ended_at", "stdout_path", "stderr_path", "stdout_bytes", "stderr_bytes")) {
            if ($null -eq $record.$field) { throw "command record missing $field" }
        }
    }
    $secretRecord = $summary.command_records | Where-Object name -eq "redaction"
    $secretText = Get-Content -Raw -Encoding UTF8 (Join-Path $tempRoot $secretRecord.stderr_path)
    if ($secretText -match "self-test-secret" -or $secretText -notmatch "\[REDACTED\]") { throw "secret redaction failed" }
    $exit7 = $summary.command_records | Where-Object name -eq "forced-exit-7"
    if ($exit7.exit_code -ne 7) { throw "forced exit 7 was not preserved" }

    $failureRoot = Join-Path $tempRoot "forced-failure"
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Mode SelfTest -EvidenceRoot $failureRoot -SelfTestForceFailure 2>$null
    $forcedExit = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    if ($forcedExit -eq 0) { throw "forced failure unexpectedly passed" }
    $failure = Get-Content -Raw -Encoding UTF8 (Join-Path $failureRoot "acceptance-summary.json") | ConvertFrom-Json
    if ($failure.status -ne "FAIL" -or $failure.completed_rounds -ne 0) { throw "failure did not reset rounds" }
    if ($failure.command_records.Count -ne 1 -or $failure.command_records[0].exit_code -ne 7) { throw "failure was not immediate" }

    Write-Output "BUREAU_TOOL_USE_ACCEPTANCE_RUNNER_TEST_PASS"
} finally {
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
