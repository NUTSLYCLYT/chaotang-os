param(
    [ValidateSet("SelfTest", "Preflight", "Rounds")]
    [string]$Mode = "Preflight",
    [ValidateRange(1, 100)]
    [int]$Rounds = 10,
    [string]$EvidenceRoot = "",
    [string]$CommandManifest = "",
    [string]$PythonExecutable = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot
$defaultCommandManifest = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "final_acceptance_commands.json")
)
$expectedCommandManifestSha256 = "697615aee31f63187d7103685320ba9b4c23c31e9dfbdffd6d63592f06095a25"
if ($Mode -eq "Rounds" -and $Rounds -ne 10) {
    throw "Rounds must be exactly 10 for formal acceptance"
}
if (-not $CommandManifest) {
    $CommandManifest = $defaultCommandManifest
}
$CommandManifest = [System.IO.Path]::GetFullPath($CommandManifest)
if (-not (Test-Path -LiteralPath $CommandManifest -PathType Leaf)) {
    throw "command manifest is missing: $CommandManifest"
}
if (
    $Mode -ne "SelfTest" -and
    -not $CommandManifest.Equals($defaultCommandManifest, [System.StringComparison]::OrdinalIgnoreCase)
) {
    throw "formal command manifest must be the repository default"
}
if (
    $Mode -ne "SelfTest" -and
    (Get-FileHash -LiteralPath $CommandManifest -Algorithm SHA256).Hash.ToLowerInvariant() -ne
        $expectedCommandManifestSha256
) {
    throw "formal command manifest does not match the reviewed SHA-256 contract"
}
if (-not $EvidenceRoot) {
    $EvidenceRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
        "chaotang-final-acceptance-" + (Get-Date -Format "yyyyMMdd-HHmmss")
    )
}
$EvidenceRoot = [System.IO.Path]::GetFullPath($EvidenceRoot)
$repoPrefix = $repoRoot.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
if (
    $EvidenceRoot.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $EvidenceRoot.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
    (Test-Path -LiteralPath $EvidenceRoot)
) {
    throw "EvidenceRoot must be a new directory outside the repository"
}
[System.IO.Directory]::CreateDirectory($EvidenceRoot) | Out-Null

function Get-Sha256File {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-Sha256Text {
    param([string]$Value)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Convert-ToRepoRelativePath {
    param([string]$Path)
    $absolute = [System.IO.Path]::GetFullPath($Path)
    if ($absolute.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return "."
    }
    $prefix = $repoRoot.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
    if (-not $absolute.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "path is outside repository root: $absolute"
    }
    return $absolute.Substring($prefix.Length).Replace("\", "/")
}

function Get-DisplayPath {
    param([string]$Path)
    $absolute = [System.IO.Path]::GetFullPath($Path)
    try {
        return Convert-ToRepoRelativePath $absolute
    }
    catch {
        return $absolute
    }
}

function Stop-OwnedProcessTree {
    param([System.Diagnostics.Process]$Process)
    if ($Process.HasExited) { return }
    $killer = $null
    try {
        $psi = [System.Diagnostics.ProcessStartInfo]::new()
        $psi.FileName = Join-Path $env:SystemRoot "System32\taskkill.exe"
        $psi.Arguments = "/PID $($Process.Id) /T /F"
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $killer = [System.Diagnostics.Process]::new()
        $killer.StartInfo = $psi
        if ($killer.Start()) {
            $killerOut = $killer.StandardOutput.ReadToEndAsync()
            $killerErr = $killer.StandardError.ReadToEndAsync()
            [void]$killer.WaitForExit(10000)
            [void]$killerOut.GetAwaiter().GetResult()
            [void]$killerErr.GetAwaiter().GetResult()
        }
    }
    finally {
        if ($null -ne $killer) { $killer.Dispose() }
    }
    if (-not $Process.HasExited) {
        $Process.Kill()
    }
    [void]$Process.WaitForExit(10000)
}

function Invoke-NativeTextProcess {
    param(
        [string]$FileName,
        [string]$Arguments,
        [string]$WorkingDirectory,
        [int]$TimeoutSeconds
    )
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FileName
    $psi.Arguments = $Arguments
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $psi.StandardErrorEncoding = [System.Text.UTF8Encoding]::new($false)
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $psi
    try {
        if (-not $process.Start()) { throw "failed to start process: $FileName" }
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        $completed = $process.WaitForExit($TimeoutSeconds * 1000)
        if (-not $completed) { Stop-OwnedProcessTree $process }
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        return [ordered]@{
            exit_code = if ($completed) { $process.ExitCode } else { 124 }
            timed_out = -not $completed
            stdout = $stdout
            stderr = $stderr
        }
    }
    finally {
        $process.Dispose()
    }
}

function Assert-GitEnumerationSucceeded {
    param([object]$Result, [string]$Context)
    if ($Result.exit_code -ne 0 -or $Result.stderr) {
        throw "$Context failed: exit=$($Result.exit_code) stderr=$($Result.stderr)"
    }
}

function Get-SourceAggregateFromFiles {
    param([string]$Root, [string[]]$RelativeFiles)
    $set = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::Ordinal
    )
    foreach ($raw in $RelativeFiles) {
        if (-not $raw) { continue }
        $relative = $raw.Replace("\", "/")
        $absolute = Join-Path $Root $relative
        if (Test-Path -LiteralPath $absolute -PathType Leaf) {
            [void]$set.Add($relative)
        }
    }
    $files = [string[]]$set
    [Array]::Sort($files, [System.StringComparer]::Ordinal)
    $entries = foreach ($file in $files) {
        [ordered]@{
            path = $file
            sha256 = Get-Sha256File (Join-Path $Root $file)
        }
    }
    $canonical = ($entries | ForEach-Object { "$($_.path)`t$($_.sha256)" }) -join "`n"
    return [ordered]@{
        algorithm = "SHA-256"
        canonical_format = "UTF-8 LF lines: <repo-relative-path><TAB><lowercase-file-sha256>; paths sorted ordinal"
        file_count = $files.Count
        aggregate = Get-Sha256Text $canonical
        files = @($entries)
    }
}

function Get-SourceAggregate {
    $gitResult = Invoke-NativeTextProcess `
        "git.exe" `
        '-c core.quotepath=false ls-files -co -z --exclude-standard "--exclude=fresh-task8-*"' `
        $repoRoot `
        60
    Assert-GitEnumerationSucceeded $gitResult "git source enumeration"
    $rawFiles = @($gitResult.stdout.Split([char]0, [System.StringSplitOptions]::RemoveEmptyEntries))
    return Get-SourceAggregateFromFiles $repoRoot $rawFiles
}

function Write-Json {
    param([string]$Path, [object]$Value)
    $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Save-RedactedStream {
    param([string]$Path, [string]$Value)
    $safe = $Value -replace '(?i)(authorization:\s*)[^\r\n]+', '$1[REDACTED]'
    $safe = $safe -replace '(?i)(cookie:\s*)[^\r\n]+', '$1[REDACTED]'
    $safe = $safe -replace '(?i)(courtos_session=)[^;\s]+', '$1[REDACTED]'
    $safe = $safe -replace '(?i)sk-[A-Za-z0-9_-]{8,}', '[REDACTED]'
    $safe = $safe -replace '(?i)("(?:api[_-]?key|token|password|secret|credential)"\s*:\s*")[^"]+("?)', '$1[REDACTED]$2'
    $safe = $safe -replace '(?i)((?:api[_-]?key|token|password|secret)\s*[=:]\s*)[^\s]+', '$1[REDACTED]'
    [System.IO.File]::WriteAllText(
        $Path,
        $safe,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Get-TestMetrics {
    param([string]$Output)
    $metrics = [ordered]@{}
    $pytest = [regex]::Matches(
        $Output,
        '(?m)(?<passed>\d+) passed(?:, (?<failed>\d+) failed)?(?:, (?<skipped>\d+) skipped)?'
    )
    if ($pytest.Count -gt 0) {
        $match = $pytest[$pytest.Count - 1]
        $metrics.kind = "pytest"
        $metrics.passed = [int]$match.Groups["passed"].Value
        $metrics.failed = if ($match.Groups["failed"].Success) { [int]$match.Groups["failed"].Value } else { 0 }
        $metrics.skipped = if ($match.Groups["skipped"].Success) { [int]$match.Groups["skipped"].Value } else { 0 }
        return $metrics
    }
    $nodePass = [regex]::Match($Output, '(?m)^.*?pass (?<passed>\d+)\s*$')
    $nodeFail = [regex]::Match($Output, '(?m)^.*?fail (?<failed>\d+)\s*$')
    if ($nodePass.Success -and $nodeFail.Success) {
        $metrics.kind = "node-test"
        $metrics.passed = [int]$nodePass.Groups["passed"].Value
        $metrics.failed = [int]$nodeFail.Groups["failed"].Value
        return $metrics
    }
    return $null
}

function Invoke-AuditedCommand {
    param(
        [string]$Label,
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command,
        [int]$TimeoutSeconds = 3600
    )
    $safeLabel = ($Label + "-" + $Name) -replace '[^A-Za-z0-9_.-]', '-'
    $stdoutName = "$safeLabel.stdout.log"
    $stderrName = "$safeLabel.stderr.log"
    $stdoutPath = Join-Path $EvidenceRoot $stdoutName
    $stderrPath = Join-Path $EvidenceRoot $stderrName
    $started = (Get-Date).ToUniversalTime().ToString("o")
    $native = Invoke-NativeTextProcess `
        "cmd.exe" `
        "/d /s /c `"$Command`"" `
        $WorkingDirectory `
        $TimeoutSeconds
    $stdout = $native.stdout
    $stderr = $native.stderr
    Save-RedactedStream $stdoutPath $stdout
    Save-RedactedStream $stderrPath $stderr
    $combined = $stdout + "`n" + $stderr
    return [ordered]@{
        name = $Name
        cwd = Convert-ToRepoRelativePath $WorkingDirectory
        command = $Command
        started_at = $started
        ended_at = (Get-Date).ToUniversalTime().ToString("o")
        exit_code = $native.exit_code
        timed_out = $native.timed_out
        timeout_seconds = $TimeoutSeconds
        stdout_path = $stdoutName
        stderr_path = $stderrName
        stdout_bytes = ([System.IO.FileInfo]$stdoutPath).Length
        stderr_bytes = ([System.IO.FileInfo]$stderrPath).Length
        stdout_sha256 = Get-Sha256File $stdoutPath
        stderr_sha256 = Get-Sha256File $stderrPath
        metrics = Get-TestMetrics $combined
    }
}

function Assert-AuditedCommandSucceeded {
    param([object]$Record, [string]$Label)
    if ($Record.exit_code -ne 0) {
        $summary.completed_rounds = 0
        throw "$Label command failed: $($Record.name), exit=$($Record.exit_code)"
    }
}

function Test-UntrackedFileWhitespace {
    param([string]$Root, [string]$File)
    $escaped = $File.Replace('"', '\"')
    $check = Invoke-NativeTextProcess `
        "git.exe" `
        "-c core.autocrlf=false diff --no-index --check -- NUL `"$escaped`"" `
        $Root `
        60
    if ($check.exit_code -gt 1 -or $check.stdout -or $check.stderr) {
        throw "untracked whitespace check failed for ${File}: exit=$($check.exit_code) stdout=$($check.stdout) stderr=$($check.stderr)"
    }
}

function Invoke-UntrackedWhitespaceCheck {
    $enumeration = Invoke-NativeTextProcess `
        "git.exe" `
        '-c core.quotepath=false ls-files --others -z --exclude-standard "--exclude=fresh-task8-*"' `
        $repoRoot `
        60
    Assert-GitEnumerationSucceeded $enumeration "git untracked file enumeration"
    $untracked = @($enumeration.stdout.Split([char]0, [System.StringSplitOptions]::RemoveEmptyEntries))
    $checked = 0
    foreach ($file in $untracked) {
        if (-not $file) { continue }
        Test-UntrackedFileWhitespace $repoRoot $file
        $checked += 1
    }
    return [ordered]@{ status = "PASS"; checked_files = $checked }
}

function Get-ProtectedPortSnapshot {
    $entries = foreach ($port in @(3000, 8000, 13000, 18000, 13381, 18381)) {
        $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        [ordered]@{
            port = $port
            pids = @($listeners | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)
        }
    }
    return @($entries)
}

function Get-PortSnapshotCanonical {
    param([object[]]$Snapshot)
    return (@($Snapshot) | ForEach-Object {
        "$($_.port):$((@($_.pids) | Sort-Object) -join ',')"
    }) -join "|"
}

function Assert-ProtectedPortsClear {
    param([object[]]$Snapshot)
    $occupied = @($Snapshot | Where-Object { @($_.pids).Count -gt 0 })
    if ($occupied.Count -gt 0) {
        throw "protected ports are occupied: $((Get-PortSnapshotCanonical $occupied))"
    }
}

function Assert-ProtectedPortSnapshotUnchanged {
    param([object[]]$Before, [object[]]$After)
    if ((Get-PortSnapshotCanonical $Before) -ne (Get-PortSnapshotCanonical $After)) {
        throw "protected port snapshot changed during acceptance"
    }
}

function ConvertTo-ProtectedRuntimeEntry {
    param(
        [System.IO.FileSystemInfo]$Item,
        [string]$RelativePath
    )
    $normalizedPath = $RelativePath.Replace("\", "/")
    $isReparsePoint = ($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
    if ($isReparsePoint) {
        $target = if ($Item.PSObject.Properties.Name -contains "Target") {
            (@($Item.Target) -join "|")
        }
        else {
            ""
        }
        return [ordered]@{
            path = $normalizedPath
            exists = $true
            kind = "reparse_point"
            target_sha256 = Get-Sha256Text $target
        }
    }
    if ($Item.PSIsContainer) {
        return [ordered]@{
            path = $normalizedPath
            exists = $true
            kind = "directory"
        }
    }
    return [ordered]@{
        path = $normalizedPath
        exists = $true
        kind = "file"
        length = $Item.Length
        last_write_utc_ticks = $Item.LastWriteTimeUtc.Ticks
        content_sha256 = Get-Sha256File $Item.FullName
    }
}

function Get-ProtectedRuntimeMetadata {
    param([string]$Root = $repoRoot)
    $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
    $rootPrefix = $resolvedRoot.TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
    $relativePaths = @(
        "backend\data",
        "backend\.env",
        "backend\.env.example",
        "frontend\.env",
        "frontend\.env.local",
        "frontend\.env.development",
        "frontend\.env.production"
    )
    $entries = [System.Collections.Generic.List[object]]::new()
    foreach ($relative in $relativePaths) {
        $absolute = Join-Path $resolvedRoot $relative
        if (-not (Test-Path -LiteralPath $absolute)) {
            $entries.Add([ordered]@{ path = $relative.Replace("\", "/"); exists = $false })
            continue
        }
        $item = Get-Item -LiteralPath $absolute -Force
        $entries.Add((ConvertTo-ProtectedRuntimeEntry $item $relative))
        $isReparsePoint = ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
        if ($relative -eq "backend\data" -and $item.PSIsContainer -and -not $isReparsePoint) {
            $pending = [System.Collections.Generic.Stack[string]]::new()
            $pending.Push($item.FullName)
            while ($pending.Count -gt 0) {
                $directory = $pending.Pop()
                foreach ($child in @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop)) {
                    $childPath = [System.IO.Path]::GetFullPath($child.FullName)
                    if (-not $childPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                        throw "protected runtime path escaped root: $childPath"
                    }
                    $childRelative = $childPath.Substring($rootPrefix.Length)
                    $entries.Add((ConvertTo-ProtectedRuntimeEntry $child $childRelative))
                    $childIsReparsePoint = (
                        $child.Attributes -band [System.IO.FileAttributes]::ReparsePoint
                    ) -ne 0
                    if ($child.PSIsContainer -and -not $childIsReparsePoint) {
                        $pending.Push($childPath)
                    }
                }
            }
        }
    }
    $canonical = ($entries | Sort-Object { $_.path } | ConvertTo-Json -Depth 5 -Compress)
    return [ordered]@{
        sha256 = Get-Sha256Text $canonical
        entries = @($entries | Sort-Object { $_.path })
    }
}

function Assert-ProtectedRuntimeUnchanged {
    param([object]$Before, [object]$After)
    if ($Before.sha256 -ne $After.sha256) {
        throw "protected runtime metadata changed during acceptance"
    }
}

function Get-UsablePython {
    param([string]$Requested)
    $candidates = [System.Collections.Generic.List[string]]::new()
    if ($Requested) { $candidates.Add([System.IO.Path]::GetFullPath($Requested)) }
    $venv = Join-Path $repoRoot "backend\.venv\Scripts\python.exe"
    if (-not $Requested -and (Test-Path -LiteralPath $venv -PathType Leaf)) {
        $candidates.Add($venv)
    }
    if (-not $Requested) {
        $systemPython = Get-Command python.exe -ErrorAction SilentlyContinue
        if ($systemPython -and $systemPython.Source) { $candidates.Add($systemPython.Source) }
    }
    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $probe = Invoke-NativeTextProcess $candidate "--version" $repoRoot 10
            if ($probe.exit_code -eq 0) {
                return [System.IO.Path]::GetFullPath($candidate)
            }
        }
        catch {
            continue
        }
    }
    throw "no usable Python executable; pass -PythonExecutable with an existing working interpreter"
}

$manifest = Get-Content -Raw -Encoding UTF8 $CommandManifest | ConvertFrom-Json
if ($manifest.schema_version -ne 1 -or -not $manifest.commands) {
    throw "unsupported or empty final acceptance command manifest"
}
$seenNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($item in $manifest.commands) {
    if (-not $item.name -or -not $item.cwd -or -not $item.command) {
        throw "every command manifest item requires name, cwd, and command"
    }
    if (-not $seenNames.Add([string]$item.name)) {
        throw "duplicate command name: $($item.name)"
    }
    $cwd = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ([string]$item.cwd)))
    [void](Convert-ToRepoRelativePath $cwd)
    if (-not (Test-Path -LiteralPath $cwd -PathType Container)) {
        throw "command cwd is missing: $cwd"
    }
}

$summaryPath = Join-Path $EvidenceRoot "acceptance-summary.json"
$summary = [ordered]@{
    schema_version = 1
    mode = $Mode
    status = "RUNNING"
    requested_rounds = if ($Mode -eq "Rounds") { $Rounds } else { 0 }
    completed_rounds = 0
    started_at = (Get-Date).ToUniversalTime().ToString("o")
    ended_at = $null
    command_manifest = Get-DisplayPath $CommandManifest
    command_manifest_sha256 = Get-Sha256File $CommandManifest
    runner_sha256 = Get-Sha256File $PSCommandPath
    adr0028_sha256 = Get-Sha256File (Join-Path $repoRoot "docs\decisions\0028-decree-evidence-flow-governance-baseline.md")
    initial_source = $null
    protected_ports_before = Get-ProtectedPortSnapshot
    protected_ports_after = $null
    protected_runtime_before = $null
    protected_runtime_after = $null
    port_guard_self_test = $false
    source_aggregate_self_test = $false
    git_stderr_self_test = $false
    untracked_whitespace_self_test = $false
    command_records = @()
    baseline = $null
    rounds = @()
    failure = $null
}

if ($Mode -eq "SelfTest") {
    try {
        if ((Get-Sha256File $defaultCommandManifest) -ne $expectedCommandManifestSha256) {
            throw "self-test pinned manifest hash mismatch"
        }
        $summary.manifest_hash_self_test = $true
        $selfTestPython = Get-UsablePython $PythonExecutable
        if (-not (Test-Path -LiteralPath $selfTestPython -PathType Leaf)) {
            throw "self-test Python probe returned a missing executable"
        }
        $summary.python_probe_self_test = $true
        $warning = Invoke-AuditedCommand "self-test" "warning-exit-zero" $repoRoot (
            "echo sk-selftest-stdout-secret & echo self-test-warning 1>&2 & exit /b 0"
        )
        $failureProbe = Invoke-AuditedCommand "self-test" "failure-redaction" $repoRoot (
            "echo token=self-test-secret 1>&2 & echo Cookie: courtos_session=selftest-cookie-secret 1>&2 & echo sk-selftest-stderr-secret 1>&2 & echo {`"credential`":`"selftest-json-secret`"} 1>&2 & exit /b 7"
        )
        $timeoutProbe = Invoke-AuditedCommand "self-test" "owned-process-timeout" $repoRoot (
            "ping 127.0.0.1 -n 6 >NUL"
        ) 1
        $summary.command_records = @($warning, $failureProbe, $timeoutProbe)
        if (
            $warning.exit_code -ne 0 -or
            $failureProbe.exit_code -ne 7 -or
            -not $timeoutProbe.timed_out -or
            $timeoutProbe.exit_code -ne 124
        ) {
            throw "self-test native exit capture failed"
        }
        $summary.completed_rounds = 1
        $failureDetected = $false
        try {
            Assert-AuditedCommandSucceeded $failureProbe "self-test-round-2"
        }
        catch {
            $failureDetected = $true
        }
        if (-not $failureDetected -or $summary.completed_rounds -ne 0) {
            throw "self-test failure did not invalidate previously completed rounds"
        }
        $fakeBefore = @([ordered]@{ port = 13381; pids = @() })
        $fakeAfter = @([ordered]@{ port = 13381; pids = @(424242) })
        $portDriftDetected = $false
        try {
            Assert-ProtectedPortSnapshotUnchanged $fakeBefore $fakeAfter
        }
        catch {
            $portDriftDetected = $true
        }
        if (-not $portDriftDetected) { throw "self-test protected-port drift was not detected" }
        $summary.port_guard_self_test = $true
        $runtimeFixture = Join-Path $EvidenceRoot "protected-runtime-fixture"
        $runtimeData = Join-Path $runtimeFixture "backend\data"
        $runtimeNested = Join-Path $runtimeData "nested"
        [System.IO.Directory]::CreateDirectory($runtimeNested) | Out-Null
        $runtimeAlpha = Join-Path $runtimeNested "alpha.bin"
        [System.IO.File]::WriteAllText(
            $runtimeAlpha,
            "alpha",
            [System.Text.UTF8Encoding]::new($false)
        )
        $runtimeBefore = Get-ProtectedRuntimeMetadata -Root $runtimeFixture
        [System.IO.Directory]::SetLastWriteTimeUtc(
            $runtimeData,
            (Get-Item -LiteralPath $runtimeData).LastWriteTimeUtc.AddSeconds(-10)
        )
        [System.IO.Directory]::SetLastWriteTimeUtc(
            $runtimeNested,
            (Get-Item -LiteralPath $runtimeNested).LastWriteTimeUtc.AddSeconds(-10)
        )
        $runtimeTransient = Join-Path $runtimeData "transient.tmp"
        [System.IO.File]::WriteAllText(
            $runtimeTransient,
            "temporary",
            [System.Text.UTF8Encoding]::new($false)
        )
        [System.IO.File]::Delete($runtimeTransient)
        $runtimeStable = Get-ProtectedRuntimeMetadata -Root $runtimeFixture
        Assert-ProtectedRuntimeUnchanged $runtimeBefore $runtimeStable

        $runtimeBeta = Join-Path $runtimeNested "beta.bin"
        [System.IO.File]::WriteAllText(
            $runtimeBeta,
            "beta",
            [System.Text.UTF8Encoding]::new($false)
        )
        $runtimeAddedDetected = $false
        try {
            Assert-ProtectedRuntimeUnchanged $runtimeStable (
                Get-ProtectedRuntimeMetadata -Root $runtimeFixture
            )
        }
        catch {
            $runtimeAddedDetected = $true
        }
        [System.IO.File]::Delete($runtimeBeta)

        $runtimeDeleteBaseline = Get-ProtectedRuntimeMetadata -Root $runtimeFixture
        [System.IO.File]::Delete($runtimeAlpha)
        $runtimeDeletedDetected = $false
        try {
            Assert-ProtectedRuntimeUnchanged $runtimeDeleteBaseline (
                Get-ProtectedRuntimeMetadata -Root $runtimeFixture
            )
        }
        catch {
            $runtimeDeletedDetected = $true
        }
        [System.IO.File]::WriteAllText(
            $runtimeAlpha,
            "alpha",
            [System.Text.UTF8Encoding]::new($false)
        )

        $runtimeContentBaseline = Get-ProtectedRuntimeMetadata -Root $runtimeFixture
        $runtimeAlphaWriteTime = (Get-Item -LiteralPath $runtimeAlpha).LastWriteTimeUtc
        [System.IO.File]::WriteAllText(
            $runtimeAlpha,
            "omega",
            [System.Text.UTF8Encoding]::new($false)
        )
        [System.IO.File]::SetLastWriteTimeUtc($runtimeAlpha, $runtimeAlphaWriteTime)
        $runtimeContentDetected = $false
        try {
            Assert-ProtectedRuntimeUnchanged $runtimeContentBaseline (
                Get-ProtectedRuntimeMetadata -Root $runtimeFixture
            )
        }
        catch {
            $runtimeContentDetected = $true
        }
        if (
            -not $runtimeAddedDetected -or
            -not $runtimeDeletedDetected -or
            -not $runtimeContentDetected
        ) {
            throw "self-test protected-runtime terminal-state detection failed"
        }
        $summary.protected_runtime_guard_self_test = $true

        $runtimeOutside = Join-Path $EvidenceRoot "protected-runtime-outside"
        [System.IO.Directory]::CreateDirectory($runtimeOutside) | Out-Null
        [System.IO.File]::WriteAllText(
            (Join-Path $runtimeOutside "must-not-be-followed.bin"),
            "outside",
            [System.Text.UTF8Encoding]::new($false)
        )
        $runtimeLink = Join-Path $runtimeNested "outside-link"
        $null = & (Join-Path $env:SystemRoot "System32\cmd.exe") /d /c `
            mklink /J $runtimeLink $runtimeOutside 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "self-test could not create isolated reparse fixture"
        }
        try {
            $runtimeReparseSnapshot = Get-ProtectedRuntimeMetadata -Root $runtimeFixture
            $runtimeLinkRelative = "backend/data/nested/outside-link"
            $runtimeLinkEntry = @(
                $runtimeReparseSnapshot.entries |
                    Where-Object { $_.path -eq $runtimeLinkRelative }
            )
            $runtimeFollowedEntries = @(
                $runtimeReparseSnapshot.entries |
                    Where-Object { $_.path.StartsWith($runtimeLinkRelative + "/") }
            )
            if (
                $runtimeLinkEntry.Count -ne 1 -or
                $runtimeLinkEntry[0].kind -ne "reparse_point" -or
                $runtimeFollowedEntries.Count -ne 0
            ) {
                throw "self-test protected-runtime reparse containment failed"
            }
        }
        finally {
            if (Test-Path -LiteralPath $runtimeLink) {
                [System.IO.Directory]::Delete($runtimeLink)
            }
        }
        $summary.protected_runtime_reparse_self_test = $true
        $sourceFixture = Join-Path $EvidenceRoot "source-aggregate-fixture"
        [System.IO.Directory]::CreateDirectory($sourceFixture) | Out-Null
        $alphaPath = Join-Path $sourceFixture "alpha.txt"
        $betaPath = Join-Path $sourceFixture "beta.txt"
        [System.IO.File]::WriteAllText($alphaPath, "alpha`n", [System.Text.UTF8Encoding]::new($false))
        $aggregateBefore = Get-SourceAggregateFromFiles $sourceFixture @("alpha.txt")
        [System.IO.File]::WriteAllText($alphaPath, "changed`n", [System.Text.UTF8Encoding]::new($false))
        $aggregateChanged = Get-SourceAggregateFromFiles $sourceFixture @("alpha.txt")
        [System.IO.File]::WriteAllText($betaPath, "beta`n", [System.Text.UTF8Encoding]::new($false))
        $aggregateAdded = Get-SourceAggregateFromFiles $sourceFixture @("alpha.txt", "beta.txt")
        if (
            $aggregateBefore.aggregate -eq $aggregateChanged.aggregate -or
            $aggregateBefore.file_count -ne $aggregateChanged.file_count -or
            $aggregateAdded.file_count -ne ($aggregateChanged.file_count + 1) -or
            $aggregateAdded.aggregate -eq $aggregateChanged.aggregate
        ) {
            throw "self-test source aggregate did not detect content and file-count drift"
        }
        $summary.source_aggregate_self_test = $true
        $gitStderrDetected = $false
        try {
            Assert-GitEnumerationSucceeded ([ordered]@{
                exit_code = 0
                stderr = "permission denied"
            }) "self-test git enumeration"
        }
        catch {
            $gitStderrDetected = $true
        }
        if (-not $gitStderrDetected) { throw "self-test git stderr was not fail-closed" }
        $summary.git_stderr_self_test = $true
        $cleanPath = Join-Path $sourceFixture "clean.txt"
        $invalidPath = Join-Path $sourceFixture "invalid.txt"
        [System.IO.File]::WriteAllText($cleanPath, "clean`n", [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::WriteAllText($invalidPath, "invalid `n", [System.Text.UTF8Encoding]::new($false))
        Test-UntrackedFileWhitespace $sourceFixture "clean.txt"
        $invalidWhitespaceDetected = $false
        try {
            Test-UntrackedFileWhitespace $sourceFixture "invalid.txt"
        }
        catch {
            $invalidWhitespaceDetected = $true
        }
        if (-not $invalidWhitespaceDetected) { throw "self-test invalid whitespace was not detected" }
        $summary.untracked_whitespace_self_test = $true
        $summary.status = "SELF_TEST_PASS"
        $summary.ended_at = (Get-Date).ToUniversalTime().ToString("o")
        $summary.protected_ports_after = Get-ProtectedPortSnapshot
        Write-Json $summaryPath $summary
        Write-Output "FINAL_ACCEPTANCE_SELF_TEST_PASS evidence=$EvidenceRoot"
        exit 0
    }
    catch {
        $summary.status = "FAIL"
        $summary.completed_rounds = 0
        $summary.failure = $_.Exception.Message
        $summary.ended_at = (Get-Date).ToUniversalTime().ToString("o")
        $summary.protected_ports_after = Get-ProtectedPortSnapshot
        Write-Json $summaryPath $summary
        Write-Error $_
        exit 1
    }
}

$requiresPython = @(
    $manifest.commands | Where-Object { ([string]$_.command).Contains("{PYTHON}") }
).Count -gt 0
$resolvedPython = if ($requiresPython) { Get-UsablePython $PythonExecutable } else { $null }
$quotedPython = if ($resolvedPython) { '"' + $resolvedPython.Replace('"', '""') + '"' } else { "" }
$env:PYTHONDONTWRITEBYTECODE = "1"
$env:PYTHONFAULTHANDLER = "1"
$env:PYTHONPATH = (Join-Path $repoRoot "backend") + ";" + (Join-Path $repoRoot "backend\.venv\Lib\site-packages")
$env:CHAOTANG_INTEGRATION_PYTHON = if ($resolvedPython) { $resolvedPython } else { "" }
$env:CHAOTANG_ACCOUNTING_SOURCE_DIR = ""
$env:CHAOTANG_DECREE_JOB_WORKER_ENABLED = "0"
$env:DEEPSEEK_API_KEY = "offline-acceptance-disabled"
$env:OPENAI_API_KEY = ""
$env:ANTHROPIC_API_KEY = ""
$env:JINYIWEI_EXTERNAL_NETWORK_ENABLED = ""
$env:JINYIWEI_MCP_CREDENTIAL_SOURCE = "env"
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:HTTP_PROXY = "http://127.0.0.1:9"
$env:HTTPS_PROXY = "http://127.0.0.1:9"
$env:ALL_PROXY = "http://127.0.0.1:9"
$env:NO_PROXY = "127.0.0.1,localhost,::1"

$initialPorts = $null
$initialRuntime = $null
$initialSource = $null
$roundRecord = $null
try {
    $initialPorts = $summary.protected_ports_before
    Assert-ProtectedPortsClear $initialPorts
    $initialRuntime = Get-ProtectedRuntimeMetadata
    $summary.protected_runtime_before = $initialRuntime
    $initialSource = Get-SourceAggregate
    $summary.initial_source = $initialSource
    $sourceManifest = [ordered]@{
        generated_at = (Get-Date).ToUniversalTime().ToString("o")
        repository_root = $repoRoot
        source = $initialSource
        command_manifest_sha256 = $summary.command_manifest_sha256
        runner_sha256 = $summary.runner_sha256
        adr0028_sha256 = $summary.adr0028_sha256
        python_executable = $resolvedPython
        protected_ports = $initialPorts
        protected_runtime = $initialRuntime
    }
    Write-Json (Join-Path $EvidenceRoot "source-manifest.json") $sourceManifest
    Write-Json $summaryPath $summary

    $baselineMetrics = @{}
    $iterations = if ($Mode -eq "Rounds") { $Rounds + 1 } else { 1 }
    for ($iteration = 0; $iteration -lt $iterations; $iteration += 1) {
        $isBaseline = $iteration -eq 0
        $label = if ($isBaseline) { "baseline" } else { "round-$iteration" }
        $roundNumber = if ($isBaseline) { 0 } else { $iteration }
        $roundStart = Get-SourceAggregate
        if ($roundStart.aggregate -ne $initialSource.aggregate -or $roundStart.file_count -ne $initialSource.file_count) {
            throw "$label start source aggregate changed"
        }
        $roundRecord = [ordered]@{
            round = $roundNumber
            label = $label
            status = "RUNNING"
            started_at = (Get-Date).ToUniversalTime().ToString("o")
            ended_at = $null
            start_source_aggregate = $roundStart.aggregate
            end_source_aggregate = $null
            commands = @()
            untracked_whitespace = $null
            protected_ports_start = Get-ProtectedPortSnapshot
            protected_ports_end = $null
            protected_runtime_start = Get-ProtectedRuntimeMetadata
            protected_runtime_end = $null
        }
        Assert-ProtectedPortsClear $roundRecord.protected_ports_start
        Assert-ProtectedPortSnapshotUnchanged $initialPorts $roundRecord.protected_ports_start
        Assert-ProtectedRuntimeUnchanged $initialRuntime $roundRecord.protected_runtime_start
        if ($isBaseline) {
            $summary.baseline = $roundRecord
        }
        else {
            $summary.rounds += $roundRecord
        }
        Write-Json $summaryPath $summary
        foreach ($item in $manifest.commands) {
            $cwd = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ([string]$item.cwd)))
            $command = ([string]$item.command).Replace("{PYTHON}", $quotedPython)
            $record = Invoke-AuditedCommand $label ([string]$item.name) $cwd $command
            $roundRecord.commands += $record
            $summary.command_records += $record
            Write-Json $summaryPath $summary
            Assert-AuditedCommandSucceeded $record $label
            if ($isBaseline -and $null -ne $record.metrics) {
                $baselineMetrics[[string]$item.name] = ($record.metrics | ConvertTo-Json -Compress)
            }
            elseif (-not $isBaseline -and $baselineMetrics.ContainsKey([string]$item.name)) {
                $actualMetrics = $record.metrics | ConvertTo-Json -Compress
                if ($actualMetrics -ne $baselineMetrics[[string]$item.name]) {
                    throw "$label test metrics changed: $($item.name)"
                }
            }
        }
        $roundRecord.untracked_whitespace = Invoke-UntrackedWhitespaceCheck
        $roundRecord.protected_ports_end = Get-ProtectedPortSnapshot
        $roundRecord.protected_runtime_end = Get-ProtectedRuntimeMetadata
        Assert-ProtectedPortsClear $roundRecord.protected_ports_end
        Assert-ProtectedPortSnapshotUnchanged $initialPorts $roundRecord.protected_ports_end
        Assert-ProtectedRuntimeUnchanged $initialRuntime $roundRecord.protected_runtime_end
        $roundEnd = Get-SourceAggregate
        $roundRecord.end_source_aggregate = $roundEnd.aggregate
        if ($roundEnd.aggregate -ne $roundRecord.start_source_aggregate -or $roundEnd.file_count -ne $initialSource.file_count) {
            throw "$label end source aggregate changed"
        }
        $roundRecord.status = "PASS"
        $roundRecord.ended_at = (Get-Date).ToUniversalTime().ToString("o")
        if (-not $isBaseline) {
            $summary.completed_rounds = $roundNumber
        }
        Write-Json $summaryPath $summary
    }
    $summary.protected_ports_after = Get-ProtectedPortSnapshot
    $summary.protected_runtime_after = Get-ProtectedRuntimeMetadata
    Assert-ProtectedPortsClear $summary.protected_ports_after
    Assert-ProtectedPortSnapshotUnchanged $initialPorts $summary.protected_ports_after
    Assert-ProtectedRuntimeUnchanged $initialRuntime $summary.protected_runtime_after
    $summary.status = if ($Mode -eq "Rounds") { "PASS" } else { "PREFLIGHT_PASS" }
    $summary.ended_at = (Get-Date).ToUniversalTime().ToString("o")
    Write-Json $summaryPath $summary
    Write-Output "FINAL_ACCEPTANCE_$($summary.status) aggregate=$($initialSource.aggregate) evidence=$EvidenceRoot"
    exit 0
}
catch {
    $failureRecord = $_
    if ($null -ne $roundRecord -and $roundRecord.status -eq "RUNNING") {
        $roundRecord.status = "FAIL"
        $roundRecord.ended_at = (Get-Date).ToUniversalTime().ToString("o")
    }
    $summary.status = "FAIL"
    $summary.completed_rounds = 0
    $summary.failure = $failureRecord.Exception.Message
    $summary.ended_at = (Get-Date).ToUniversalTime().ToString("o")
    $summary.protected_ports_after = Get-ProtectedPortSnapshot
    try {
        $summary.protected_runtime_after = Get-ProtectedRuntimeMetadata
    }
    catch {
        $summary.protected_runtime_after = [ordered]@{ error = $_.Exception.Message }
    }
    Write-Json $summaryPath $summary
    Write-Error $failureRecord
    exit 1
}
