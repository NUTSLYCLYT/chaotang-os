$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runner = Join-Path $PSScriptRoot "run_task9_acceptance.ps1"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("task9-runner-test-" + [guid]::NewGuid())

try {
    if (-not (Test-Path -LiteralPath $runner)) {
        throw "acceptance runner is missing"
    }

    & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Mode SelfTest -EvidenceRoot $tempRoot
    if ($LASTEXITCODE -ne 0) {
        throw "runner self-test failed with exit $LASTEXITCODE"
    }

    $manifestPath = Join-Path $tempRoot "fingerprint-manifest.json"
    $summaryPath = Join-Path $tempRoot "acceptance-summary.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) { throw "manifest missing" }
    if (-not (Test-Path -LiteralPath $summaryPath)) { throw "summary missing" }

    $manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
    $summary = Get-Content -Raw -Encoding UTF8 $summaryPath | ConvertFrom-Json
    if ($manifest.algorithm -ne "SHA-256") { throw "unexpected algorithm" }
    if (-not $manifest.included_files) { throw "included file list missing" }
    if (-not ($manifest.excluded_paths -contains ".superpowers/sdd/independent-runtime-skills-task-9-evidence/")) { throw "evidence exclusion missing" }
    if (-not ($manifest.excluded_paths -contains ".superpowers/sdd/progress.md")) { throw "progress status exclusion missing" }
    if (-not ($manifest.included_files.path -contains "docs/decisions/0036-downstream-agent-runtime-skills.md")) { throw "runtime skill ADR missing from fingerprint" }
    $focusedCommand = ($manifest.commands | Where-Object name -eq "focused").command
    $focusedFiles = Get-ChildItem (Join-Path $repoRoot "backend/tests") -File -Filter "*runtime_skill*.py" | ForEach-Object { "backend/tests/$($_.Name)" }
    foreach ($focusedFile in $focusedFiles) {
        if ($focusedCommand -notmatch [regex]::Escape($focusedFile)) { throw "focused matrix missing $focusedFile" }
    }
    if ($summary.status -ne "SELF_TEST_PASS") { throw "self-test did not pass" }
    if ($summary.completed_rounds -ne 0) { throw "self-test must not count rounds" }
    if (-not $summary.command_records) { throw "raw command record missing" }
    $record = $summary.command_records[0]
    if ($record.exit_code -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $tempRoot $record.stdout_path))) { throw "stdout/exit evidence missing" }
    if (-not (Test-Path -LiteralPath (Join-Path $tempRoot $record.stderr_path))) { throw "stderr evidence missing" }
    $failureRecord = $summary.command_records[1]
    if ($failureRecord.exit_code -ne 7) { throw "nonzero exit evidence missing" }
    $failureText = Get-Content -Raw -Encoding UTF8 (Join-Path $tempRoot $failureRecord.stderr_path)
    if ($failureText -match "self-test-secret" -or $failureText -notmatch "\[REDACTED\]") { throw "secret redaction evidence missing" }

    $failureRoot = Join-Path $tempRoot "forced-failure"
    $savedErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Mode SelfTest -EvidenceRoot $failureRoot -SelfTestForceFailure 2>$null
    $forcedExitCode = $LASTEXITCODE
    $ErrorActionPreference = $savedErrorActionPreference
    if ($forcedExitCode -eq 0) { throw "forced failure unexpectedly passed" }
    $failureSummary = Get-Content -Raw -Encoding UTF8 (Join-Path $failureRoot "acceptance-summary.json") | ConvertFrom-Json
    if ($failureSummary.status -ne "FAIL" -or $failureSummary.completed_rounds -ne 0) { throw "fail-fast summary did not reset to zero" }

    Write-Output "TASK9_ACCEPTANCE_RUNNER_TEST_PASS"
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
