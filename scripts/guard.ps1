# guard.ps1
# Mechanical enforcement of the rules that text alone has repeatedly failed to enforce.
# Reads the hook payload as JSON on stdin, dispatches by -Event, and emits a JSON finding
# only when a check actually fires.
#
# Selection criterion: ZERO false positives. A hook that cries wolf gets ignored, and an
# ignored hook is exactly the diluted-rule failure this was built to replace. A rule that
# cannot be detected without guessing is left to its skill.
#
# Checks (event chosen per work-rules-automation AU-21 - by what the check reads):
#   PostToolUse        Write|Edit        raw NUL bytes in the written file        (work-rules-shell SH-2)
#   PostToolUse        Write|Edit        .bat saved with bare LF line endings     (work-rules-shell SH-15)
#   PostToolUse        Bash|PowerShell   commit adds/deletes files, no README     (work-rules-shell SH-23)
#   PostToolUseFailure Bash|PowerShell   UnicodeEncodeError in the failure output (work-rules-shell SH-12)
#
# Both command events cover PowerShell as well as Bash. They were Bash-only until 2026-07-30,
# which left a hole exactly the size of this environment's other first-class shell: a commit made
# through the PowerShell tool skipped the README check entirely.
#
# Command-text pattern matching lives in the sibling pattern-guard.sh, which runs on PreToolUse
# because command text does not change between hook and execution.
#
# Messages are one imperative sentence plus the rule ID (AU-24). The skill owns the rationale.
#
# Constraints, all learned the hard way:
#   * ASCII only. PowerShell 5.1 reads a BOM-less .ps1 as cp949 and corrupts non-ASCII source.
#   * Never block a session: every path is wrapped and the script always exits 0.
#   * No && / || / ternary - not available in 5.1.

param(
  # No PreToolUse. Command text is handled by pattern-guard.sh, and everything here reads state
  # the observed command changes (AU-21). Leaving the value in the set invited calling it with an
  # event this script has no branch for, which silently ran the Write|Edit byte checks instead.
  [ValidateSet("PostToolUse", "PostToolUseFailure")]
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

  # ---------------- PostToolUseFailure / Bash|PowerShell : SH-12 ----------------
  if ($Event -eq "PostToolUseFailure") {
    # Look for the signature in the failure OUTPUT, not in the whole payload. The command text is
    # part of $raw, so a command that merely names this error would have fired whenever it failed
    # for any reason at all. Removing the command first is a strict improvement: when the command
    # does not contain the string the behaviour is identical, and when the removal cannot match
    # because of JSON escaping it falls back to the old check rather than going silent.
    $probe = $raw
    $cmdText = ""
    if ($hookInput.tool_input -and $hookInput.tool_input.command) { $cmdText = [string]$hookInput.tool_input.command }
    if ($cmdText -and $cmdText.Length -gt 0) { $probe = $raw.Replace($cmdText, "") }
    if ($probe -match "UnicodeEncodeError") {
      Emit-Context ("[SH-12] cp949 console. Do not retry this command - write the output to a UTF-8 file " +
        "and read it with the Read tool, keeping stdout to one ASCII line.")
    }
    exit 0
  }

  # ---------------- PostToolUse / Bash|PowerShell : SH-23 ----------------
  # Deliberately POST, not PRE. A PreToolUse version shipped on 2026-07-29 and produced a false
  # positive on its first live run: the command was "git add -A && git commit", so at hook time the
  # index had not been updated yet and README.md read as unstaged. A hook that inspects state the
  # command itself is about to change cannot be accurate. Read the commit that actually happened.
  if ($Event -eq "PostToolUse" -and ($hookInput.tool_name -eq "Bash" -or $hookInput.tool_name -eq "PowerShell")) {
    $cmd = ""
    if ($hookInput.tool_input -and $hookInput.tool_input.command) { $cmd = [string]$hookInput.tool_input.command }
    if ($cmd -notmatch "git\s+(-C\s+\S+\s+|-c\s+\S+\s+)*commit") { exit 0 }

    # Recover the repo from -C or from a leading cd, in that order.
    $repo = "."
    if ($cmd -match 'git\s+-C\s+"([^"]+)"') { $repo = $Matches[1] }
    elseif ($cmd -match "git\s+-C\s+'([^']+)'") { $repo = $Matches[1] }
    elseif ($cmd -match 'git\s+-C\s+(\S+)') { $repo = $Matches[1] }
    elseif ($cmd -match '^\s*cd\s+"([^"]+)"') { $repo = $Matches[1] }
    elseif ($cmd -match "^\s*cd\s+'([^']+)'") { $repo = $Matches[1] }
    elseif ($cmd -match '^\s*cd\s+(\S+)\s*(&&|;)') { $repo = $Matches[1] }

    $landed = & git -C $repo show --name-status --format= HEAD 2>$null
    if ($LASTEXITCODE -ne 0) { exit 0 }
    if (-not $landed) { exit 0 }

    # Split status from path first. Matching README against the whole line fails, because the line
    # is "M<tab>README.md" and an anchored (^|/) never sees past the tab - shipped and caught 2026-07-29.
    $structural = @()
    $hasReadme = $false
    foreach ($line in $landed) {
      if ($line -notmatch '^(\S+)\s+(.+)$') { continue }
      $status = $Matches[1]
      $file = $Matches[2].Trim()
      if ($status -match '^(A|D|R\d*)$') { $structural += $file }
      if ($file -match '(^|/)README\.md$') { $hasReadme = $true }
    }
    if ($structural.Count -eq 0) { exit 0 }
    if ($hasReadme) { exit 0 }

    $sample = ($structural | Select-Object -First 6) -join ", "
    Emit-Context ("[SH-23] The commit just made adds or removes " + $structural.Count + " file(s) without " +
      "touching README.md (" + $sample + "). Update the structure map and amend, or tell the user why not.")
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
    [void]$findings.Add("[SH-2] " + $path + " contains " + $nulCount + " raw NUL byte(s). Rewrite it from a Python " +
      "script instead of the Write tool.")
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
      [void]$findings.Add("[SH-15] " + $path + " has " + ($lf - $crlf) + " bare LF line ending(s). Rewrite it as " +
        "CRLF + UTF-8 without BOM, from a Python script.")
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
