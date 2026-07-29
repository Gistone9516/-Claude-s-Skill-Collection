# guard.ps1
# Mechanical enforcement of the rules that text alone has repeatedly failed to enforce.
# Reads the hook payload as JSON on stdin, dispatches by -Event, and emits a JSON finding
# only when a check actually fires.
#
# Selection criterion: ZERO false positives. A hook that cries wolf gets ignored, and an
# ignored hook is exactly the diluted-rule failure this was built to replace. A rule that
# cannot be detected without guessing is left to its skill.
#
# Checks:
#   PostToolUse        Write|Edit   raw NUL bytes in the written file        (work-rules-shell SH-2)
#   PostToolUse        Write|Edit   .bat saved with bare LF line endings     (work-rules-shell SH-15)
#   PostToolUseFailure Bash         UnicodeEncodeError in the failure output (work-rules-shell SH-12)
#   PreToolUse         Bash         git commit adds/deletes files, no README (CLAUDE.md G-19, SH-23)
#
# Constraints, all learned the hard way:
#   * ASCII only. PowerShell 5.1 reads a BOM-less .ps1 as cp949 and corrupts non-ASCII source.
#   * Never block a session: every path is wrapped and the script always exits 0.
#   * No && / || / ternary - not available in 5.1.

param(
  [ValidateSet("PostToolUse", "PostToolUseFailure", "PreToolUse")]
  [string]$Event = "PostToolUse"
)

$ErrorActionPreference = "Continue"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Emit-Context([string]$text) {
  $payload = @{
    hookSpecificOutput = @{
      hookEventName     = $Event
      additionalContext = $text
    }
  }
  $payload | ConvertTo-Json -Compress -Depth 5
}

try {
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
  $hookInput = $raw | ConvertFrom-Json

  # ---------------- PostToolUseFailure / Bash : SH-12 ----------------
  if ($Event -eq "PostToolUseFailure") {
    if ($raw -match "UnicodeEncodeError") {
      Emit-Context ("[guard SH-12] That Bash call died with UnicodeEncodeError. This is the measured " +
        "cp949 console trap, not a bug in the data: the Windows console here is cp949, so printing Korean " +
        "or any non-ASCII character (an em dash, a copyright sign) to stdout kills the whole run. " +
        "Do not retry the same command. Write the result to a UTF-8 file " +
        "(io.open(path, 'w', encoding='utf-8')) and read it back with the Read tool, keeping stdout to one " +
        "ASCII line. Full rule: work-rules-shell SH-12.")
    }
    exit 0
  }

  # ---------------- PreToolUse / Bash : G-19 ----------------
  if ($Event -eq "PreToolUse") {
    $cmd = ""
    if ($hookInput.tool_input -and $hookInput.tool_input.command) { $cmd = [string]$hookInput.tool_input.command }
    if ($cmd -notmatch "git\s+(-c\s+\S+\s+)*commit") { exit 0 }

    # The hook's own cwd is the session directory, which is often not the repo being committed to.
    # Recover the target from a leading cd in the command, which is how these calls are usually written.
    $repo = "."
    if ($cmd -match '^\s*cd\s+"([^"]+)"') { $repo = $Matches[1] }
    elseif ($cmd -match "^\s*cd\s+'([^']+)'") { $repo = $Matches[1] }
    elseif ($cmd -match '^\s*cd\s+(\S+)\s*(&&|;)') { $repo = $Matches[1] }

    # structure change = a file added, deleted or renamed in this commit
    $staged = & git -C $repo diff --cached --name-status 2>$null
    if ($LASTEXITCODE -ne 0) { exit 0 }
    if (-not $staged) { exit 0 }

    $structural = @()
    $hasReadme = $false
    foreach ($line in $staged) {
      if ($line -match '^(A|D|R\d*)\s+(.+)$') { $structural += $Matches[2] }
      if ($line -match '(^|/)README\.md\s*$') { $hasReadme = $true }
    }
    if ($structural.Count -eq 0) { exit 0 }
    if ($hasReadme) { exit 0 }

    $sample = ($structural | Select-Object -First 6) -join ", "
    Emit-Context ("[guard G-19] This commit adds, deletes or renames " + $structural.Count +
      " file(s) but does not touch README.md: " + $sample + ". Adding or removing files changes the " +
      "structure map, which is the hard floor for updating the root README (CLAUDE.md G-19, " +
      "work-rules-shell SH-23). Either update README.md and stage it, or state to the user why this " +
      "commit does not need it. Do not silently skip it.")
    exit 0
  }

  # ---------------- PostToolUse / Write|Edit : SH-2, SH-15 ----------------
  $path = $null
  if ($hookInput.tool_response -and $hookInput.tool_response.filePath) { $path = [string]$hookInput.tool_response.filePath }
  if (-not $path -and $hookInput.tool_input -and $hookInput.tool_input.file_path) { $path = [string]$hookInput.tool_input.file_path }
  if (-not $path) { exit 0 }
  if (-not (Test-Path -LiteralPath $path)) { exit 0 }

  $bytes = [System.IO.File]::ReadAllBytes($path)
  if ($bytes.Length -eq 0) { exit 0 }

  $findings = New-Object System.Collections.ArrayList

  # SH-2 raw control bytes written into a file
  $nulCount = 0
  foreach ($b in $bytes) { if ($b -eq 0) { $nulCount++ } }
  if ($nulCount -gt 0) {
    [void]$findings.Add("[guard SH-2] " + $path + " now contains " + $nulCount + " raw NUL byte(s). An escape " +
      "such as \0 in the Write payload became a real control character. ripgrep will treat this file as " +
      "binary so the Grep tool cannot search it, the Read tool renders NUL as whitespace so the file looks " +
      "fine, and Edit will fail with 'String to replace not found' because the visible text does not match " +
      "the actual bytes. Rewrite the file from a Python script instead of the Write tool.")
  }

  # SH-15 .bat with bare LF line endings
  if ($path.ToLower().EndsWith(".bat") -or $path.ToLower().EndsWith(".cmd")) {
    $lf = 0; $crlf = 0
    for ($i = 0; $i -lt $bytes.Length; $i++) {
      if ($bytes[$i] -eq 10) {
        $lf++
        if ($i -gt 0 -and $bytes[$i - 1] -eq 13) { $crlf++ }
      }
    }
    if ($lf -ne $crlf) {
      [void]$findings.Add("[guard SH-15] " + $path + " has " + ($lf - $crlf) + " bare LF line ending(s). cmd " +
        "does not parse a .bat saved with LF: chcp is silently skipped, the console stays on code page 949, " +
        "and the symptom looks like a text encoding problem while the cause is line endings. The Write tool " +
        "always emits LF, so rewrite this file with CRLF, UTF-8 and no BOM, from a Python script.")
    }
  }

  # This event is registered with asyncRewake, so it runs in the background and costs the session
  # nothing when nothing is wrong. A finding is surfaced by exiting 2 with plain text, which is what
  # wakes the model - not the JSON envelope the synchronous events use.
  if ($findings.Count -gt 0) {
    Write-Output ($findings -join "  ///  ")
    exit 2
  }
}
catch {
  # A hook must never block the session.
}
exit 0
