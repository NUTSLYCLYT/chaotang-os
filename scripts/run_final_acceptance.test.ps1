$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runner = Join-Path $PSScriptRoot "run_final_acceptance.ps1"
$defaultManifest = Join-Path $PSScriptRoot "final_acceptance_commands.json"
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
    throw "final acceptance runner is missing: $runner"
}
if (-not (Test-Path -LiteralPath $defaultManifest -PathType Leaf)) {
    throw "final acceptance command manifest is missing: $defaultManifest"
}
foreach ($scriptPath in @($runner, $PSCommandPath)) {
    $parseTokens = $null
    $parseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $scriptPath,
        [ref]$parseTokens,
        [ref]$parseErrors
    )
    if (@($parseErrors).Count -gt 0) {
        throw "PowerShell parser rejected $scriptPath`: $($parseErrors[0].Message)"
    }
}

$tempRoot = [System.IO.Path]::GetFullPath(
    (Join-Path ([System.IO.Path]::GetTempPath()) ("chaotang-final-runner-test-" + [guid]::NewGuid().ToString("N")))
)
[System.IO.Directory]::CreateDirectory($tempRoot) | Out-Null
$succeeded = $false
$repoEvidence = $null
try {
    $selfTestEvidence = Join-Path $tempRoot "self-test"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
        -Mode SelfTest -EvidenceRoot $selfTestEvidence -CommandManifest $defaultManifest
    if ($LASTEXITCODE -ne 0) {
        throw "runner self-test failed with exit $LASTEXITCODE"
    }
    $summary = Get-Content -Raw -Encoding UTF8 (
        Join-Path $selfTestEvidence "acceptance-summary.json"
    ) | ConvertFrom-Json
    if ($summary.status -ne "SELF_TEST_PASS" -or $summary.completed_rounds -ne 0) {
        throw "runner self-test summary mismatch"
    }
    if ($summary.command_records.Count -ne 3) {
        throw "runner self-test must record warning, failure, and timeout commands"
    }
    $warningRecord = $summary.command_records[0]
    $failureProbe = $summary.command_records[1]
    $timeoutProbe = $summary.command_records[2]
    if ($warningRecord.exit_code -ne 0 -or $failureProbe.exit_code -ne 7) {
        throw "runner did not preserve native exit codes"
    }
    $warningStderr = Get-Content -Raw -Encoding UTF8 (
        Join-Path $selfTestEvidence $warningRecord.stderr_path
    )
    if ($warningStderr -notmatch "self-test-warning") {
        throw "exit-zero stderr warning was not captured"
    }
    $warningStdout = Get-Content -Raw -Encoding UTF8 (
        Join-Path $selfTestEvidence $warningRecord.stdout_path
    )
    if ($warningStdout -match "sk-selftest-stdout-secret" -or $warningStdout -notmatch "\[REDACTED\]") {
        throw "runner stdout redaction failed"
    }
    $redactedStderr = Get-Content -Raw -Encoding UTF8 (
        Join-Path $selfTestEvidence $failureProbe.stderr_path
    )
    if (
        $redactedStderr -match "self-test-secret|selftest-cookie-secret|sk-selftest-stderr-secret|selftest-json-secret" -or
        ([regex]::Matches($redactedStderr, "\[REDACTED\]")).Count -lt 4
    ) {
        throw "runner stderr redaction failed"
    }
    if (-not $timeoutProbe.timed_out -or $timeoutProbe.exit_code -ne 124) {
        throw "runner timeout probe did not terminate and record the owned process"
    }
    if (-not $summary.port_guard_self_test) {
        throw "runner did not behavior-test protected-port drift detection"
    }
    if (
        -not ($summary.PSObject.Properties.Name -contains "protected_runtime_guard_self_test") -or
        -not $summary.protected_runtime_guard_self_test
    ) {
        throw "runner did not behavior-test protected-runtime terminal-state detection"
    }
    if (
        -not ($summary.PSObject.Properties.Name -contains "protected_runtime_reparse_self_test") -or
        -not $summary.protected_runtime_reparse_self_test
    ) {
        throw "runner did not behavior-test protected-runtime reparse containment"
    }
    if (
        -not ($summary.PSObject.Properties.Name -contains "python_probe_self_test") -or
        -not $summary.python_probe_self_test
    ) {
        throw "runner did not behavior-test the Python probe"
    }
    if (
        -not ($summary.PSObject.Properties.Name -contains "manifest_hash_self_test") -or
        -not $summary.manifest_hash_self_test
    ) {
        throw "runner did not behavior-test the pinned manifest hash"
    }
    if (-not $summary.source_aggregate_self_test) {
        throw "runner did not behavior-test source content and file-count drift"
    }
    if (-not $summary.git_stderr_self_test) {
        throw "runner did not behavior-test fail-closed git stderr handling"
    }
    if (-not $summary.untracked_whitespace_self_test) {
        throw "runner did not behavior-test clean and invalid untracked whitespace"
    }

    $reducedManifest = Join-Path $tempRoot "reduced-commands.json"
    @{
        schema_version = 1
        commands = @(
            @{ name = "fake-pass"; cwd = "."; command = "exit /b 0" }
        )
    } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reducedManifest -Encoding UTF8

    $roundCountEvidence = Join-Path $tempRoot "round-count"
    $roundCountLog = Join-Path $tempRoot "round-count.log"
    $savedErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
        -Mode Rounds -Rounds 9 -EvidenceRoot $roundCountEvidence `
        -CommandManifest $reducedManifest *> $roundCountLog
    $roundCountExit = $LASTEXITCODE
    $ErrorActionPreference = $savedErrorActionPreference
    if ($roundCountExit -eq 0) {
        throw "runner accepted fewer than ten formal rounds"
    }
    if ((Get-Content -Raw -Encoding UTF8 $roundCountLog) -notmatch "Rounds must be exactly 10") {
        throw "runner did not reject the formal round count before execution"
    }

    $reducedEvidence = Join-Path $tempRoot "reduced-manifest"
    $reducedLog = Join-Path $tempRoot "reduced-manifest.log"
    $ErrorActionPreference = "Continue"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
        -Mode Rounds -Rounds 10 -EvidenceRoot $reducedEvidence `
        -CommandManifest $reducedManifest *> $reducedLog
    $reducedExit = $LASTEXITCODE
    $ErrorActionPreference = $savedErrorActionPreference
    if ($reducedExit -eq 0) {
        throw "runner accepted a reduced external formal manifest"
    }
    if ((Get-Content -Raw -Encoding UTF8 $reducedLog) -notmatch "formal command manifest must be the repository default") {
        throw "runner rejected the reduced manifest for the wrong reason"
    }

    $repoEvidence = Join-Path $repoRoot (".final-acceptance-evidence-test-" + [guid]::NewGuid().ToString("N"))
    $repoEvidenceLog = Join-Path $tempRoot "repo-evidence.log"
    $ErrorActionPreference = "Continue"
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner `
        -Mode SelfTest -EvidenceRoot $repoEvidence -CommandManifest $defaultManifest *> $repoEvidenceLog
    $repoEvidenceExit = $LASTEXITCODE
    $ErrorActionPreference = $savedErrorActionPreference
    if ($repoEvidenceExit -eq 0 -or (Test-Path -LiteralPath $repoEvidence)) {
        throw "runner allowed evidence writes inside the repository"
    }
    if ((Get-Content -Raw -Encoding UTF8 $repoEvidenceLog) -notmatch "EvidenceRoot must be a new directory outside the repository") {
        throw "runner rejected the repository evidence path for the wrong reason"
    }

    $runnerSource = Get-Content -Raw -Encoding UTF8 $runner
    foreach ($requiredToken in @(
        "ReadToEndAsync", "WaitForExit", ".ExitCode", "Get-SourceAggregate",
        "Invoke-UntrackedWhitespaceCheck", "completed_rounds = 0",
        "start_source_aggregate", "end_source_aggregate", "Get-ProtectedRuntimeMetadata",
        "expectedCommandManifestSha256", "timed_out", "Assert-ProtectedPortSnapshotUnchanged"
    )) {
        if (-not $runnerSource.Contains($requiredToken)) {
            throw "runner source guard missing: $requiredToken"
        }
    }
    foreach ($offlineEnvironmentLine in @(
        '$env:DEEPSEEK_API_KEY = "offline-acceptance-disabled"',
        '$env:OPENAI_API_KEY = ""',
        '$env:ANTHROPIC_API_KEY = ""'
    )) {
        if (-not $runnerSource.Contains($offlineEnvironmentLine)) {
            throw "runner offline environment guard missing: $offlineEnvironmentLine"
        }
    }

    $manifest = Get-Content -Raw -Encoding UTF8 $defaultManifest | ConvertFrom-Json
    $names = @($manifest.commands | ForEach-Object { $_.name })
    $expectedNames = @(
        "direct-focused-backend", "backend-ruff", "backend-full",
        "direct-focused-frontend", "frontend-lint", "frontend-typegen",
        "frontend-typecheck", "frontend-full", "frontend-build", "integration",
        "integration-runner-tests", "migration-test", "migration",
        "harness", "harness-self-test", "hook-self-test", "delivery-self-test",
        "tracked-diff-check", "staged-diff-check"
    )
    if (($names -join "|") -ne ($expectedNames -join "|")) {
        throw "final command manifest order or membership changed"
    }
    $manifestText = Get-Content -Raw -Encoding UTF8 $defaultManifest
    foreach ($requiredCommandText in @(
        "test_synthetic_accounting_acceptance_app.py",
        "test_accounting_report_period_policy.py",
        "test_runtime_storage_isolation.py",
        "decreeJobPolling.test.ts",
        "shiguanDecision.test.ts",
        "next.cmd typegen",
        "tsc.cmd --noEmit --incremental false --pretty false",
        "npm run build",
        "node scripts/verify_integration.mjs"
    )) {
        if (-not $manifestText.Contains($requiredCommandText)) {
            throw "final command manifest guard missing: $requiredCommandText"
        }
    }
    $succeeded = $true
    Write-Output "FINAL_ACCEPTANCE_RUNNER_TEST_PASS"
}
finally {
    if (
        $repoEvidence -and
        (Test-Path -LiteralPath $repoEvidence) -and
        $repoEvidence.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and
        [System.IO.Path]::GetFileName($repoEvidence).StartsWith(".final-acceptance-evidence-test-")
    ) {
        Remove-Item -LiteralPath $repoEvidence -Recurse -Force
    }
    $systemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath()).TrimEnd("\") + "\"
    if (
        $succeeded -and
        $tempRoot.StartsWith($systemTemp, [System.StringComparison]::OrdinalIgnoreCase) -and
        [System.IO.Path]::GetFileName($tempRoot).StartsWith("chaotang-final-runner-test-")
    ) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
