param(
    [ValidateSet("SelfTest", "Preflight", "Rounds", "PostDocument")]
    [string]$Mode = "Preflight",
    [ValidateRange(1, 10)]
    [int]$Rounds = 10,
    [string]$EvidenceRoot = ".superpowers/sdd/bureau-agent-tool-use-evidence",
    [switch]$SelfTestForceFailure
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ($SelfTestForceFailure -and $Mode -ne "SelfTest") { throw "SelfTestForceFailure is valid only in SelfTest mode" }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
if (-not [System.IO.Path]::IsPathRooted($EvidenceRoot)) { $EvidenceRoot = Join-Path $repoRoot $EvidenceRoot }
$EvidenceRoot = [System.IO.Path]::GetFullPath($EvidenceRoot)
[System.IO.Directory]::CreateDirectory($EvidenceRoot) | Out-Null

$excludedPaths = @(
    ".superpowers/sdd/bureau-agent-tool-use-evidence/",
    ".superpowers/sdd/bureau-agent-tool-use-acceptance.log",
    ".superpowers/sdd/bureau-agent-tool-use-task-9-report.md"
)
$productTaskPath = "docs/product/tasks/2026-08-03-bureau-agent-tool-use.md"
$productNormalizationMarkers = @(
    "STATUS", "AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-06",
    "AC-07", "AC-08", "AC-09", "AC-10", "IMPLEMENTATION", "ACCEPTANCE-REVIEW"
)
$includeSpecs = @(
    "AGENTS.md", "backend/AGENTS.md", "backend/app", "backend/tests", "backend/pyproject.toml",
    "scripts/check_harness.mjs", "scripts/run_bureau_tool_use_acceptance.ps1", "scripts/run_bureau_tool_use_acceptance.test.ps1",
    ".agents/hooks/check-harness.mjs", ".agents/skills/product-flow/scripts/run-claude-delivery.mjs", ".github/workflows/harness.yml",
    "docs/decisions/0028-decree-evidence-flow-governance-baseline.md", "docs/decisions/0037-bureau-agent-controlled-tool-use.md",
    "docs/failures/2026-08-04-tool-authority-drift-audit-false-green.md",
    "docs/superpowers/specs/2026-08-03-bureau-agent-tool-use-design.md", "docs/superpowers/plans/2026-08-03-bureau-agent-tool-use.md",
    $productTaskPath
)
$commands = @(
    [ordered]@{ name = "focused"; command = "python -m pytest backend/tests/test_bureau_tool_models.py backend/tests/test_bureau_tool_registry.py backend/tests/test_bureau_tool_policy.py backend/tests/test_bureau_tool_executor.py backend/tests/test_bureau_tool_handlers.py backend/tests/test_bureau_tool_loop.py backend/tests/test_bureau_tool_use_integration.py -q" },
    [ordered]@{ name = "compatibility"; command = "python -m pytest backend/tests/test_bureaus_agent.py backend/tests/test_agent_evidence_protocol.py backend/tests/test_ministry_runtime_skills.py backend/tests/test_junjichu_runtime_skill.py backend/tests/test_chancellor_graph.py backend/tests/test_downstream_runtime_skill_compatibility.py -q" },
    [ordered]@{ name = "ruff"; command = "python -m ruff check backend/app backend/tests" },
    [ordered]@{ name = "backend-suite"; command = "python -m pytest backend/tests -q" },
    [ordered]@{ name = "harness"; command = "node scripts/check_harness.mjs" },
    [ordered]@{ name = "harness-self-test"; command = "node scripts/check_harness.mjs --self-test" },
    [ordered]@{ name = "hook-self-test"; command = "node .agents/hooks/check-harness.mjs --self-test" },
    [ordered]@{ name = "delivery-self-test"; command = "node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test" },
    [ordered]@{ name = "diff-check"; command = 'cmd /d /c "git diff --check 2>&1"' }
)
$postDocumentCommands = @($commands[4], $commands[5], $commands[6], $commands[7], $commands[8])

function Convert-ToRepoRelativePath {
    param([string]$AbsolutePath)
    $prefix = $repoRoot.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
    $full = [System.IO.Path]::GetFullPath($AbsolutePath)
    if (-not $full.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { throw "path outside repository: $full" }
    $full.Substring($prefix.Length).Replace("\", "/")
}
function Get-IncludedFiles {
    $files = foreach ($spec in $includeSpecs) {
        if (Test-Path -LiteralPath $spec -PathType Leaf) { $spec.Replace("\", "/") }
        elseif (Test-Path -LiteralPath $spec -PathType Container) {
            Get-ChildItem -LiteralPath $spec -File -Recurse | ForEach-Object { Convert-ToRepoRelativePath $_.FullName }
        } else { throw "fingerprint input missing: $spec" }
    }
    @($files | Sort-Object -Unique)
}
function Get-NormalizedProductBytes {
    param([string]$AbsolutePath)
    $text = [System.IO.File]::ReadAllText($AbsolutePath, [System.Text.Encoding]::UTF8)
    $allMarkers = [regex]::Matches($text, '<!-- ACCEPTANCE-FP-(?:BEGIN|END):[^>]+ -->')
    if ($allMarkers.Count -ne ($productNormalizationMarkers.Count * 2)) { throw "product normalization marker count invalid" }
    foreach ($name in $productNormalizationMarkers) {
        $begin = "<!-- ACCEPTANCE-FP-BEGIN:$name -->"
        $end = "<!-- ACCEPTANCE-FP-END:$name -->"
        if ([regex]::Matches($text, [regex]::Escape($begin)).Count -ne 1) { throw "product normalization BEGIN marker invalid: $name" }
        if ([regex]::Matches($text, [regex]::Escape($end)).Count -ne 1) { throw "product normalization END marker invalid: $name" }
        $pattern = [regex]::new([regex]::Escape($begin) + '([\s\S]*?)' + [regex]::Escape($end))
        $match = $pattern.Match($text)
        if (-not $match.Success) { throw "product normalization marker order/unclosed: $name" }
        $content = $match.Groups[1].Value
        if ($content -match '<!-- ACCEPTANCE-FP-(?:BEGIN|END):') { throw "product normalization nested marker: $name" }
        $text = $pattern.Replace($text, "$begin<ACCEPTANCE-POST-STATUS:$name>$end", 1)
    }
    [System.Text.Encoding]::UTF8.GetBytes($text)
}
function Get-CanonicalFileHash {
    param([string]$File)
    $absolute = Join-Path $repoRoot $File
    if ($File -ceq $productTaskPath) {
        $bytes = Get-NormalizedProductBytes $absolute
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant() }
        finally { $sha.Dispose() }
    }
    (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Get-Fingerprint {
    param([string[]]$Files)
    $entries = foreach ($file in $Files) {
        [ordered]@{ path = $file; sha256 = Get-CanonicalFileHash $file; hash_mode = $(if ($file -ceq $productTaskPath) { "marked-block-normalization-v1" } else { "raw-file-sha256" }) }
    }
    $canonical = ($entries | ForEach-Object { "$($_.path)`t$($_.sha256)" }) -join "`n"
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $digest = ([BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($canonical)))).Replace("-", "").ToLowerInvariant() }
    finally { $sha.Dispose() }
    [ordered]@{ algorithm = "SHA-256"; canonical_format = "UTF-8 sorted lines: <repo-relative-path><TAB><lowercase-file-sha256>"; fingerprint = $digest; files = @($entries) }
}
function Write-Json { param([string]$Path, [object]$Value); $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8 }
function Save-RedactedStream {
    param([string]$Path, [string]$Value)
    $safe = $Value -replace '(?i)(authorization\s*:\s*bearer\s+)[^\s]+', '$1[REDACTED]'
    $safe = $safe -replace '(?i)((?:api[_-]?key|access[_-]?token|token|password|secret)\s*[=:]\s*)[^\s]+', '$1[REDACTED]'
    $safe = $safe -replace '(?i)\bsk-[A-Za-z0-9_-]{8,}\b', '[REDACTED]'
    [System.IO.File]::WriteAllText($Path, $safe, [System.Text.UTF8Encoding]::new($false))
}
function Invoke-AuditedCommand {
    param([string]$Label, [string]$Name, [string]$Command, [bool]$FormalRound)
    $stdoutName = "$Label-$Name.stdout.log"; $stderrName = "$Label-$Name.stderr.log"
    $stdoutPath = Join-Path $EvidenceRoot $stdoutName; $stderrPath = Join-Path $EvidenceRoot $stderrName
    $started = (Get-Date).ToUniversalTime().ToString("o")
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = "cmd.exe"; $psi.Arguments = "/d /s /c `"$Command`""; $psi.WorkingDirectory = $repoRoot
    $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new(); $process.StartInfo = $psi
    if (-not $process.Start()) { throw "failed to start command: $Name" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync(); $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit(); $stdout = $stdoutTask.GetAwaiter().GetResult(); $stderr = $stderrTask.GetAwaiter().GetResult(); $exitCode = $process.ExitCode; $process.Dispose()
    Save-RedactedStream $stdoutPath $stdout; Save-RedactedStream $stderrPath $stderr
    [ordered]@{ name = $Name; command = $Command; formal_round = $FormalRound; started_at = $started; ended_at = (Get-Date).ToUniversalTime().ToString("o"); exit_code = $exitCode; stdout_path = $stdoutName; stderr_path = $stderrName; stdout_bytes = ([System.IO.FileInfo]$stdoutPath).Length; stderr_bytes = ([System.IO.FileInfo]$stderrPath).Length }
}

$includedFiles = Get-IncludedFiles
$frozen = Get-Fingerprint $includedFiles
$normalizedFiles = @([ordered]@{ path = $productTaskPath; algorithm = "marked-block-normalization-v1"; markers = $productNormalizationMarkers; replacement_format = "<ACCEPTANCE-POST-STATUS:{marker-name}>"; scope = "Only bytes between each exact unique BEGIN/END marker are normalized. Marker bytes and all unmarked product requirements, acceptance text, interfaces, and scope remain fingerprinted. Missing, duplicate, unknown, nested, reversed, or unclosed markers fail closed." })
$manifest = [ordered]@{ algorithm = $frozen.algorithm; canonical_format = $frozen.canonical_format; repository_root = $repoRoot; included_specs = $includeSpecs; included_files = $frozen.files; normalized_files = $normalizedFiles; excluded_paths = $excludedPaths; exclusion_reason = "Raw evidence, append-only acceptance log, and Task 9 report are path-excluded. The exact product task remains included with marked-block-normalization-v1 for 13 explicitly named post-acceptance mutable blocks only; all unmarked bytes remain fingerprinted."; commands = $commands }
Write-Json (Join-Path $EvidenceRoot "fingerprint-manifest.json") $manifest
$summaryPath = Join-Path $EvidenceRoot "acceptance-summary.json"
$summary = [ordered]@{ schema_version = 1; mode = $Mode; formal_round = ($Mode -eq "Rounds"); status = "RUNNING"; requested_rounds = $(if ($Mode -eq "Rounds") { $Rounds } else { 0 }); completed_rounds = 0; command_count = 0; started_at = (Get-Date).ToUniversalTime().ToString("o"); ended_at = $null; frozen_fingerprint = $frozen.fingerprint; command_records = @(); rounds = @(); failure = $null }
Write-Json $summaryPath $summary

try {
    if ($Mode -eq "SelfTest") {
        if ($SelfTestForceFailure) {
            $record = Invoke-AuditedCommand "self-test-failure" "forced-exit-7" "exit /b 7" $false
            $summary.command_records += $record; $summary.command_count++
            if ($record.exit_code -ne 0) { throw "self-test forced exit 7" }
        }
        $capture = Invoke-AuditedCommand "self-test" "capture" "echo self-test-stdout & echo self-test-stderr 1>&2 & exit /b 0" $false
        $summary.command_records += $capture; $summary.command_count++
        if ($capture.exit_code -ne 0) { throw "self-test capture failed" }
        $redaction = Invoke-AuditedCommand "self-test" "redaction" "echo token=self-test-secret 1>&2 & exit /b 0" $false
        $summary.command_records += $redaction; $summary.command_count++
        $text = Get-Content -Raw -Encoding UTF8 (Join-Path $EvidenceRoot $redaction.stderr_path)
        if ($text -match "self-test-secret" -or $text -notmatch "\[REDACTED\]") { throw "self-test redaction failed" }
        $exit7 = Invoke-AuditedCommand "self-test" "forced-exit-7" "exit /b 7" $false
        $summary.command_records += $exit7; $summary.command_count++
        if ($exit7.exit_code -ne 7) { throw "self-test exit code mismatch" }
        $summary.status = "SELF_TEST_PASS"
    } else {
        $matrix = if ($Mode -eq "PostDocument") { $postDocumentCommands } else { $commands }
        $iterations = if ($Mode -eq "Rounds") { $Rounds } else { 1 }
        for ($round = 1; $round -le $iterations; $round++) {
            $formal = $Mode -eq "Rounds"; $label = if ($formal) { "round-$round" } elseif ($Mode -eq "Preflight") { "preflight" } else { "post-document" }
            $start = (Get-Fingerprint $includedFiles).fingerprint
            if ($start -ne $frozen.fingerprint) { throw "$label start fingerprint changed" }
            $roundRecord = [ordered]@{ round = $(if ($formal) { $round } else { 0 }); label = $label; formal_round = $formal; started_at = (Get-Date).ToUniversalTime().ToString("o"); ended_at = $null; start_fingerprint = $start; end_fingerprint = $null; commands = @(); status = "RUNNING" }
            foreach ($item in $matrix) {
                $record = Invoke-AuditedCommand $label $item.name $item.command $formal
                $roundRecord.commands += $record; $summary.command_records += $record; $summary.command_count++
                Write-Json $summaryPath $summary
                if ($record.exit_code -ne 0) { throw "$label command failed: $($item.name), exit=$($record.exit_code)" }
            }
            $roundRecord.end_fingerprint = (Get-Fingerprint $includedFiles).fingerprint
            if ($roundRecord.end_fingerprint -ne $roundRecord.start_fingerprint) { throw "$label end fingerprint changed" }
            $roundRecord.ended_at = (Get-Date).ToUniversalTime().ToString("o"); $roundRecord.status = "PASS"; $summary.rounds += $roundRecord
            if ($formal) { $summary.completed_rounds = $round }; Write-Json $summaryPath $summary
        }
        $summary.status = if ($Mode -eq "Rounds") { "PASS" } elseif ($Mode -eq "Preflight") { "PREFLIGHT_PASS" } else { "POST_DOCUMENT_PASS" }
    }
} catch {
    $summary.status = "FAIL"; $summary.completed_rounds = 0; $summary.failure = $_.Exception.Message; $summary.ended_at = (Get-Date).ToUniversalTime().ToString("o"); Write-Json $summaryPath $summary
    Write-Error $_; exit 1
}
$summary.ended_at = (Get-Date).ToUniversalTime().ToString("o"); Write-Json $summaryPath $summary
$line = "$(Get-Date -Format o) mode=$Mode status=$($summary.status) fingerprint=$($frozen.fingerprint) completed_rounds=$($summary.completed_rounds) commands=$($summary.command_count) evidence=$EvidenceRoot"
if ($EvidenceRoot.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) { Add-Content -LiteralPath (Join-Path $repoRoot ".superpowers/sdd/bureau-agent-tool-use-acceptance.log") -Value $line -Encoding UTF8 }
Write-Output "BUREAU_TOOL_USE_ACCEPTANCE_$($summary.status) fingerprint=$($frozen.fingerprint) evidence=$EvidenceRoot"
