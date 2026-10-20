# SessionStart: inject this machine's own rules, kept out of the public repo.
# Reads ~/.claude/machine.local.md (untracked; .gitignore is an allowlist) and adds the session's
# cwd drive so a rule about where work belongs can be checked. No file means no output, so a
# machine without local rules is unaffected. Rules about one computer live in that file, never in
# CLAUDE.md, which is synced to every machine.
param([string]$Event = 'SessionStart')
$ErrorActionPreference = 'Stop'
try {
  $file = Join-Path $PSScriptRoot '..\machine.local.md'
  if (-not (Test-Path -LiteralPath $file)) { exit 0 }
  $rules = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $file), [Text.Encoding]::UTF8)
  $cwd = (Get-Location).Path
  try { $in = [Console]::In.ReadToEnd() | ConvertFrom-Json; if ($in.cwd) { $cwd = $in.cwd } } catch {}
  $drive = if ($cwd -match '^([A-Za-z]):') { $Matches[1].ToUpper() + ':' } else { '(none)' }
  $text = "[machine-rules] Rules for this computer only (from ~/.claude/machine.local.md). Session cwd: $cwd (drive $drive).`n`n$rules"
  $out = @{ hookSpecificOutput = @{ hookEventName = $Event; additionalContext = $text } } | ConvertTo-Json -Depth 4 -Compress
  [Console]::OutputEncoding = [Text.Encoding]::UTF8
  [Console]::Out.Write($out)
} catch {
  # A broken local file must not block the session; say so once on stderr.
  [Console]::Error.WriteLine("machine-rules: $($_.Exception.Message)")
}
exit 0
