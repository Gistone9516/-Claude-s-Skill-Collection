# check-manifest.ps1
# Validates the live ~/.claude install against manifest.json.
#
# Modes:
#   -Mode hook   (default) emit SessionStart additionalContext JSON, only when there are findings.
#   -Mode report emit a human-readable report always. Used by a manual audit.
#
# Hard constraints, all learned the hard way:
#   * ASCII only. Windows PowerShell 5.1 reads a BOM-less .ps1 as the system ANSI code page (cp949
#     here) and corrupts non-ASCII source. Korean phrasing for the user is produced by the model,
#     not by this file.
#   * Must never block a session. Every failure path is swallowed and the script exits 0.
#   * No && / || / ternary / ?? - not available in 5.1.
#   * No single-letter accumulators. Variable names are case-insensitive, so $l silently clobbers $L.

param(
  [string]$Event = "SessionStart",
  [ValidateSet("hook", "report")]
  [string]$Mode = "hook"
)

$ErrorActionPreference = "Continue"

# The findings text is ASCII, but manifest.json supplies a Korean phrasing template that has to
# survive to stdout. Pin the encoding so the result does not depend on the console code page,
# which is cp949 on this machine.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

try {
  $base = Join-Path $env:USERPROFILE ".claude"
  $manifestPath = Join-Path $base "manifest.json"

  if (-not (Test-Path -LiteralPath $manifestPath)) {
    if ($Mode -eq "report") { Write-Output "MISSING manifest.json at $manifestPath" }
    exit 0
  }

  $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json

  $missingRequired = New-Object System.Collections.ArrayList
  $missingOptional = New-Object System.Collections.ArrayList
  $nameMismatch    = New-Object System.Collections.ArrayList
  $orphans         = New-Object System.Collections.ArrayList
  $budget          = New-Object System.Collections.ArrayList
  $appNotes        = New-Object System.Collections.ArrayList

  # ---------- skills ----------
  $declared = @{}
  foreach ($skill in $manifest.skills) {
    $declared[$skill.name] = $true
    $skillDir = Join-Path $base ("skills\" + $skill.name)
    $skillMd  = Join-Path $skillDir "SKILL.md"

    if (-not (Test-Path -LiteralPath $skillMd)) {
      $entry = "skill '" + $skill.name + "' (" + $skill.role + ")"
      if ($skill.required -eq $true) { [void]$missingRequired.Add($entry) }
      else { [void]$missingOptional.Add($entry) }
      continue
    }

    # frontmatter name must match, otherwise the Skill tool cannot resolve it
    $expectedName = $skill.name
    if ($skill.frontmatterName) { $expectedName = $skill.frontmatterName }
    $head = Get-Content -LiteralPath $skillMd -TotalCount 12 -Encoding UTF8
    $declaredName = $null
    foreach ($line in $head) {
      if ($line -match '^name:\s*(\S+)\s*$') { $declaredName = $Matches[1]; break }
    }
    if ($declaredName -and ($declaredName -ne $expectedName)) {
      [void]$nameMismatch.Add("skill '" + $skill.name + "' declares name: " + $declaredName + " (manifest expects " + $expectedName + ")")
    }

    # rule-id drift: the manifest's declared range must match the highest id in the body.
    # Added 2026-07-29 after the first pass shipped 10 stale ranges - a rule can otherwise be
    # added or lost with nothing to compare against (verify-fanout VF-13, ratcheted per VF section 9).
    if ($skill.ruleIds -and ($skill.ruleIds -match '^([A-Z]{1,3})-1\.\.[A-Z]{1,3}-(\d+)$')) {
      $prefix    = $Matches[1]
      $declaredHi = [int]$Matches[2]
      $body = Get-Content -LiteralPath $skillMd -Raw -Encoding UTF8
      $found = [regex]::Matches($body, "\b$prefix-(\d+)")
      if ($found.Count -gt 0) {
        $actualHi = 0
        foreach ($hit in $found) {
          $num = [int]$hit.Groups[1].Value
          if ($num -gt $actualHi) { $actualHi = $num }
        }
        if ($actualHi -ne $declaredHi) {
          [void]$nameMismatch.Add("skill '" + $skill.name + "' declares ruleIds " + $skill.ruleIds + " but its body's highest id is " + $prefix + "-" + $actualHi)
        }
      }
    }

    # size advisory. A skill may declare its own warnBytes when the responsibility question has
    # been answered and the answer is "yes, still one" - the exception then sits on that skill with
    # a reason next to it (work-rules-diagnosis DG-5) instead of loosening the limit for every skill.
    if ($manifest.policy.skillWarnBytes) {
      $limit = $manifest.policy.skillWarnBytes
      if ($skill.warnBytes) { $limit = $skill.warnBytes }
      $sizeBytes = (Get-Item -LiteralPath $skillMd -Force).Length
      if ($sizeBytes -gt $limit) {
        [void]$budget.Add("skills\" + $skill.name + "\SKILL.md is " + $sizeBytes + " bytes (advisory limit " + $limit + "); check it is still one responsibility")
      }
    }
  }

  # ---------- orphan skills ----------
  $skillsRoot = Join-Path $base "skills"
  if (Test-Path -LiteralPath $skillsRoot) {
    foreach ($dir in (Get-ChildItem -LiteralPath $skillsRoot -Force -ErrorAction SilentlyContinue)) {
      if (-not $declared.ContainsKey($dir.Name)) {
        [void]$orphans.Add("skills\" + $dir.Name)
      }
    }
  }

  # ---------- files ----------
  foreach ($item in $manifest.files) {
    $filePath = Join-Path $base $item.path
    if (-not (Test-Path -LiteralPath $filePath)) {
      $entry = "file '" + $item.path + "' (" + $item.role + ")"
      if ($item.required -eq $true) { [void]$missingRequired.Add($entry) }
      else { [void]$missingOptional.Add($entry) }
    }
  }

  # ---------- CLAUDE.md budget ----------
  $claudeMd = Join-Path $base "CLAUDE.md"
  if ((Test-Path -LiteralPath $claudeMd) -and $manifest.policy.claudeMdMaxBytes) {
    $mdBytes = (Get-Item -LiteralPath $claudeMd -Force).Length
    if ($mdBytes -gt $manifest.policy.claudeMdMaxBytes) {
      [void]$budget.Add("CLAUDE.md is " + $mdBytes + " bytes, over the " + $manifest.policy.claudeMdMaxBytes + " byte budget; move the excess into a skill instead of growing this file")
    }
  }

  # ---------- external apps ----------
  foreach ($app in $manifest.externalApps) {
    $appPath = $app.path
    if ($app.envOverride) {
      $override = [Environment]::GetEnvironmentVariable($app.envOverride)
      if ($override) { $appPath = $override }
    }
    if (-not (Test-Path -LiteralPath $appPath)) {
      [void]$appNotes.Add("external app '" + $app.id + "' not found at " + $appPath + "; set " + $app.envOverride + " or move the app there")
    }
  }

  # ---------- emit ----------
  $findings = New-Object System.Collections.ArrayList
  if ($missingRequired.Count -gt 0) { [void]$findings.Add("MISSING REQUIRED (" + $missingRequired.Count + "): " + ($missingRequired -join " | ")) }
  if ($nameMismatch.Count    -gt 0) { [void]$findings.Add("DECLARATION MISMATCH (" + $nameMismatch.Count + "): " + ($nameMismatch -join " | ")) }
  if ($orphans.Count         -gt 0) { [void]$findings.Add("UNREGISTERED (" + $orphans.Count + "): " + ($orphans -join ", ") + " - present on disk but absent from manifest.json; register or delete") }
  if ($budget.Count          -gt 0) { [void]$findings.Add("OVER BUDGET (" + $budget.Count + "): " + ($budget -join " | ")) }
  if ($missingOptional.Count -gt 0) { [void]$findings.Add("MISSING OPTIONAL (" + $missingOptional.Count + "): " + ($missingOptional -join " | ")) }
  if ($appNotes.Count        -gt 0) { [void]$findings.Add("EXTERNAL APP (" + $appNotes.Count + "): " + ($appNotes -join " | ")) }

  if ($Mode -eq "report") {
    Write-Output ("manifest check - " + (Get-Date -Format "yyyy-MM-dd HH:mm"))
    Write-Output ("declared skills: " + $manifest.skills.Count)
    if ($findings.Count -eq 0) {
      Write-Output "OK - every declared asset is present and registered."
    } else {
      foreach ($finding in $findings) { Write-Output $finding }
    }
    exit 0
  }

  if ($findings.Count -eq 0) { exit 0 }

  # The Korean phrasing lives in manifest.json (UTF-8, read with -Encoding UTF8), never in this
  # file - see the ASCII constraint at the top. Fallback stays English on purpose.
  $template = "state in Korean that the named asset is missing and ask the user to check"
  if ($manifest.policy.userWarningTemplate) { $template = $manifest.policy.userWarningTemplate }

  $message = "[global-config-check] The ~/.claude install does not match manifest.json. " +
             ($findings -join "  ///  ") +
             "  ///  ACTION: before doing anything else, report this to the user in Korean, naming each item, " +
             "using this phrasing template: " + $template +
             "  ///  A missing required skill means the rule set loaded this session is incomplete, so say that " +
             "plainly rather than proceeding as if it were whole. Restore from the repo recorded in manifest.json, " +
             "or update manifest.json if the asset was retired on purpose."

  $payload = @{
    hookSpecificOutput = @{
      hookEventName     = $Event
      additionalContext = $message
    }
  }
  $payload | ConvertTo-Json -Compress -Depth 5
}
catch {
  # A hook must never block the session.
  if ($Mode -eq "report") { Write-Output ("check-manifest failed: " + $_.Exception.Message) }
}
exit 0
