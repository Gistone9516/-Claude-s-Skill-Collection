# sync-check.ps1
# If a skill's SKILL.md is newer than its usage doc ('custom skill docs\<name>.md'),
# emit an additionalContext notice (JSON) telling Claude to refresh that doc.
# Rewriting the doc is an LLM task, so this script only DETECTS + NOTIFIES.
# Must never block the session/tool (errors are swallowed silently).
# Message is ASCII-only on purpose: PowerShell 5.1 reads BOM-less .ps1 as cp949
# and would corrupt non-ASCII text -> parse error.

param(
  [string]$Event = "SessionStart"
)

try {
  $base    = Join-Path $env:USERPROFILE ".claude"
  $docsDir = Join-Path $base "custom skill docs"
  $skills  = @("agent-ops", "buildflow", "deepflow")

  $stale = @()
  foreach ($n in $skills) {
    $skillPath = Join-Path $base   "skills\$n\SKILL.md"
    $docPath   = Join-Path $docsDir "$n.md"
    if (-not (Test-Path $skillPath)) { continue }
    if (-not (Test-Path $docPath)) {
      $stale += "$n (doc missing - needs creation)"
      continue
    }
    $skillT = (Get-Item $skillPath).LastWriteTimeUtc
    $docT   = (Get-Item $docPath).LastWriteTimeUtc
    if ($skillT -gt $docT) { $stale += $n }
  }

  if ($stale.Count -gt 0) {
    $list = $stale -join ", "
    $msg  = "[skill-docs-sync] These skills have a SKILL.md newer than their usage doc: $list. " +
            "Update '$docsDir\<name>.md' to match the corresponding SKILL.md. " +
            "Process: Read the SKILL.md first and reflect only the diff; confirm with the user before writing. " +
            "agent-ops is the execution-mechanics SoT, so if it changed, also re-check the references in the buildflow/deepflow docs."
    $payload = @{
      hookSpecificOutput = @{
        hookEventName     = $Event
        additionalContext = $msg
      }
    }
    $payload | ConvertTo-Json -Compress -Depth 5
  }
} catch {
  # swallow - a hook must never block the session/tool
}
