param(
    [ValidateSet("SelfTest", "Preflight", "Rounds")]
    [string]$Mode = "Preflight",
    [int]$Rounds = 10,
    [string]$EvidenceRoot = ".superpowers/sdd/independent-runtime-skills-task-9-evidence",
    [switch]$SelfTestForceFailure
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ($SelfTestForceFailure -and $Mode -ne "SelfTest") { throw "SelfTestForceFailure is valid only in SelfTest mode" }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
if (-not [System.IO.Path]::IsPathRooted($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $repoRoot $EvidenceRoot
}
$EvidenceRoot = [System.IO.Path]::GetFullPath($EvidenceRoot)
[System.IO.Directory]::CreateDirectory($EvidenceRoot) | Out-Null

$excludedPaths = @(
    ".superpowers/sdd/independent-runtime-skills-task-9-evidence/",
    ".superpowers/sdd/independent-runtime-skills-task-9-acceptance.log",
    ".superpowers/sdd/independent-runtime-skills-task-9-report.md",
    ".superpowers/sdd/progress.md",
    "docs/product/tasks/2026-08-03-independent-runtime-skills-for-all-agents.md"
)

$includeSpecs = @(
    "AGENTS.md",
    "backend/AGENTS.md",
    "backend/app",
    "backend/tests",
    "backend/pyproject.toml",
    "backend/uv.lock",
    "scripts/check_harness.mjs",
    "scripts/run_task9_acceptance.ps1",
    "scripts/run_task9_acceptance.test.ps1",
    ".agents/hooks/check-harness.mjs",
    ".agents/skills/product-flow/scripts/run-claude-delivery.mjs",
    "docs/decisions/0028-decree-evidence-flow-governance-baseline.md",
    "docs/decisions/0036-downstream-agent-runtime-skills.md",
    "docs/superpowers/plans/2026-08-03-independent-runtime-skills-for-all-agents.md",
    "docs/superpowers/specs/2026-08-03-independent-runtime-skills-for-all-agents-design.md"
)

$commands = @(
    [ordered]@{ name = "focused"; command = "python -m pytest backend/tests/test_downstream_runtime_skill_models.py backend/tests/test_downstream_runtime_skill_registry.py backend/tests/test_downstream_runtime_skill_executor.py backend/tests/test_bureau_runtime_skills.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_junjichu_runtime_skill.py backend/tests/test_downstream_runtime_skill_compatibility.py -q" },
    [ordered]@{ name = "existing-regression"; command = "python -m pytest backend/tests/test_bureaus_agent.py backend/tests/test_bureau_capabilities.py backend/tests/test_agent_evidence_protocol.py backend/tests/test_ministries_agent.py backend/tests/test_junjichu_agent.py backend/tests/test_chancellor_graph.py backend/tests/test_chancellor_runtime_registry.py backend/tests/test_chancellor_runtime_agent.py backend/tests/test_accounting_report_cross_layer.py -q" },
    [ordered]@{ name = "ruff"; command = "python -m ruff check backend/app backend/tests" },
    [ordered]@{ name = "backend-suite"; command = "python -m pytest backend/tests -q" },
    [ordered]@{ name = "harness"; command = "node scripts/check_harness.mjs" },
    [ordered]@{ name = "harness-self-test"; command = "node scripts/check_harness.mjs --self-test" },
    [ordered]@{ name = "hook-self-test"; command = "node .agents/hooks/check-harness.mjs --self-test" },
    [ordered]@{ name = "delivery-self-test"; command = "node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test" },
    [ordered]@{ name = "diff-check"; command = "git diff --check" }
)

function Convert-ToRepoRelativePath {
    param([string]$AbsolutePath)
    $rootPrefix = $repoRoot.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
    $full = [System.IO.Path]::GetFullPath($AbsolutePath)
    if (-not $full.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "path is outside repository root: $full"
    }
    return $full.Substring($rootPrefix.Length).Replace("\", "/")
}

function Get-IncludedFiles {
    $all = @()
    foreach ($spec in $includeSpecs) {
        if (Test-Path -LiteralPath $spec -PathType Leaf) {
            $all += $spec
        } elseif (Test-Path -LiteralPath $spec -PathType Container) {
            $all += Get-ChildItem -LiteralPath $spec -File -Recurse | ForEach-Object {
                Convert-ToRepoRelativePath $_.FullName
            }
        }
    }
    return @($all | ForEach-Object { $_.Replace("\", "/") } | Sort-Object -Unique)
}

function Get-Fingerprint {
    param([string[]]$Files)
    $entries = foreach ($file in $Files) {
        $absolute = Join-Path $repoRoot $file
        if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
            throw "fingerprint input missing: $file"
        }
        [ordered]@{ path = $file; sha256 = (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant() }
    }
    $canonical = ($entries | ForEach-Object { "$($_.path)`t$($_.sha256)" }) -join "`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $digest = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant() } finally { $sha.Dispose() }
    return [ordered]@{ algorithm = "SHA-256"; canonical_format = "UTF-8 lines: <repo-relative-path><TAB><lowercase-file-sha256>, sorted ordinal by path"; fingerprint = $digest; files = @($entries) }
}

function Write-Json {
    param([string]$Path, [object]$Value)
    $Value | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Save-Stream {
    param([string]$Path, [string]$Value)
    $safe = $Value -replace '(?i)(authorization:\s*bearer\s+)[^\s]+', '$1[REDACTED]'
    $safe = $safe -replace '(?i)((?:api[_-]?key|token|password|secret)\s*[=:]\s*)[^\s]+', '$1[REDACTED]'
    [System.IO.File]::WriteAllText($Path, $safe, [System.Text.UTF8Encoding]::new($false))
}

function Invoke-AuditedCommand {
    param([string]$Label, [string]$Name, [string]$Command)
    $prefix = "$Label-$Name"
    $stdoutName = "$prefix.stdout.log"
    $stderrName = "$prefix.stderr.log"
    $stdoutPath = Join-Path $EvidenceRoot $stdoutName
    $stderrPath = Join-Path $EvidenceRoot $stderrName
    $started = (Get-Date).ToString("o")
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/d /s /c `"$Command`""
    $psi.WorkingDirectory = $repoRoot
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $psi
    if (-not $process.Start()) { throw "failed to start command: $Name" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $exitCode = $process.ExitCode
    $process.Dispose()
    Save-Stream $stdoutPath $stdout
    Save-Stream $stderrPath $stderr
    return [ordered]@{
        name = $Name; command = $Command; started_at = $started; ended_at = (Get-Date).ToString("o")
        exit_code = $exitCode
        stdout_path = $stdoutName
        stderr_path = $stderrName
        stdout_bytes = ([System.IO.FileInfo]$stdoutPath).Length; stderr_bytes = ([System.IO.FileInfo]$stderrPath).Length
    }
}

$includedFiles = Get-IncludedFiles
$initial = Get-Fingerprint $includedFiles
$manifest = [ordered]@{
    algorithm = $initial.algorithm
    canonical_format = $initial.canonical_format
    repository_root = $repoRoot
    included_specs = $includeSpecs
    included_files = $initial.files
    excluded_paths = $excludedPaths
    exclusion_reason = "Runtime evidence and mutable acceptance-status documents are excluded; production code, tests, dependency/configuration inputs, acceptance runner/tests, harness entrypoints, governance baseline, design, and plan are included."
    commands = $commands
}
Write-Json (Join-Path $EvidenceRoot "fingerprint-manifest.json") $manifest

$summaryPath = Join-Path $EvidenceRoot "acceptance-summary.json"
$summary = [ordered]@{
    schema_version = 1; mode = $Mode; status = "RUNNING"; requested_rounds = $Rounds; completed_rounds = 0
    started_at = (Get-Date).ToString("o"); ended_at = $null; initial_fingerprint = $initial.fingerprint
    command_records = @(); rounds = @(); failure = $null
}
Write-Json $summaryPath $summary

try {
    if ($Mode -eq "SelfTest") {
        $record = Invoke-AuditedCommand "self-test" "capture" "echo self-test-stdout & echo self-test-stderr 1>&2 & exit /b 0"
        $summary.command_records += $record
        if ($record.exit_code -ne 0) { throw "self-test command failed" }
        $failureRecord = Invoke-AuditedCommand "self-test" "nonzero-redaction" "echo token=self-test-secret 1>&2 & exit /b 7"
        $summary.command_records += $failureRecord
        if ($failureRecord.exit_code -ne 7) { throw "self-test did not preserve nonzero exit" }
        $failureStderr = Get-Content -Raw -Encoding UTF8 (Join-Path $EvidenceRoot $failureRecord.stderr_path)
        if ($failureStderr -match "self-test-secret" -or $failureStderr -notmatch "\[REDACTED\]") { throw "self-test redaction failed" }
        if ($SelfTestForceFailure) { throw "intentional self-test fail-fast probe" }
        $summary.status = "SELF_TEST_PASS"
    } else {
        $iterations = if ($Mode -eq "Preflight") { 1 } else { $Rounds }
        for ($round = 1; $round -le $iterations; $round++) {
            $label = if ($Mode -eq "Preflight") { "preflight" } else { "round-$round" }
            $startFingerprint = (Get-Fingerprint $includedFiles).fingerprint
            if ($startFingerprint -ne $initial.fingerprint) { throw "$label start fingerprint changed" }
            $roundRecord = [ordered]@{ round = $(if ($Mode -eq "Preflight") { 0 } else { $round }); label = $label; started_at = (Get-Date).ToString("o"); ended_at = $null; start_fingerprint = $startFingerprint; end_fingerprint = $null; commands = @(); status = "RUNNING" }
            foreach ($item in $commands) {
                $record = Invoke-AuditedCommand $label $item.name $item.command
                $roundRecord.commands += $record
                $summary.command_records += $record
                Write-Json $summaryPath $summary
                if ($record.exit_code -ne 0) { throw "$label command failed: $($item.name), exit=$($record.exit_code)" }
            }
            $roundRecord.end_fingerprint = (Get-Fingerprint $includedFiles).fingerprint
            if ($roundRecord.end_fingerprint -ne $roundRecord.start_fingerprint) { throw "$label end fingerprint changed" }
            $roundRecord.ended_at = (Get-Date).ToString("o")
            $roundRecord.status = "PASS"
            $summary.rounds += $roundRecord
            if ($Mode -eq "Rounds") { $summary.completed_rounds = $round }
            Write-Json $summaryPath $summary
        }
        $summary.status = if ($Mode -eq "Preflight") { "PREFLIGHT_PASS" } else { "PASS" }
    }
} catch {
    $summary.status = "FAIL"
    $summary.completed_rounds = 0
    $summary.failure = $_.Exception.Message
    $summary.ended_at = (Get-Date).ToString("o")
    Write-Json $summaryPath $summary
    Write-Error $_
    exit 1
}

$summary.ended_at = (Get-Date).ToString("o")
Write-Json $summaryPath $summary
Write-Output "TASK9_ACCEPTANCE_$($summary.status) fingerprint=$($initial.fingerprint) evidence=$EvidenceRoot"
