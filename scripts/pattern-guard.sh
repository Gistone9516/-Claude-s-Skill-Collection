#!/usr/bin/env bash
# pattern-guard.sh
# PreToolUse scanner for command text that names a construct known to be wrong.
#
# Why PreToolUse: this reads the command TEXT, which does not change between the hook and
# execution, so matching is exact - and every pattern here is destructive or silently wrong,
# which is worth interrupting before it runs. Checks that read mutable state belong on
# PostToolUse instead (work-rules-automation AU-21).
#
# Why bash built-ins and no external commands: this runs on every Bash and PowerShell tool call.
# Measured on this machine - PowerShell process 600-700 ms, bash with one grep per pattern
# 510-640 ms, bash with only built-in matching ~130 ms. The forks were the cost, not the shell.
# So there is exactly one process here and no pipeline (AU-23).
#
# Messages are one imperative sentence plus the rule ID (AU-24). Rationale stays in the skill.
#
# Selection criterion is ZERO false positives (AU-22). A pattern whose violation depends on
# context the hook cannot see is NOT included - git stash was dropped for this reason, since
# work-rules-shell SH-7 only bites while parallel agents are running.
#
# Never blocks: always exits 0.

# Byte semantics for the whole script. A LC_ALL=C prefix does not apply to a shell built-in,
# only to an external command, so it has to be set here - the earlier inline form silently did
# nothing and the raw-UTF-8 branch of SH-1 never fired.
export LC_ALL=C

raw="$(cat 2>/dev/null)"
[ -z "$raw" ] && exit 0

findings=()

# Substring test, built-in, no fork.
has() { [[ $raw == *"$1"* ]]; }
# ERE test, built-in. The pattern must stay unquoted so bash reads it as a regex.
hasre() { local re=$1; [[ $raw =~ $re ]]; }

# SH-4 - measured: destroyed an entire README by double-encoding Korean text
if has 'Get-Content' && has 'Set-Content'; then
  findings+=("[SH-4] Do not round-trip a file through Get-Content into Set-Content - it double-encodes Korean. Use the Edit tool, or read and write from Python with io.open(..., encoding='utf-8').")
fi

# SH-5 - measured: left 731 MB across 18,650 files behind, silently
if has 'Remove-Item' && has '-Recurse' && { has 'SilentlyContinue' || has 'node_modules'; }; then
  findings+=("[SH-5] Remove-Item -Recurse cannot delete paths of 260+ characters and fails silently under SilentlyContinue. Mirror an empty directory over it with robocopy /MIR, then remove.")
fi

# SH-8 - measured: reported C:\Windows as 13.6 MB because the walk aborted on the first denied folder
if has 'EnumerateFiles' && has 'AllDirectories'; then
  findings+=("[SH-8] AllDirectories aborts the whole walk on the first UnauthorizedAccessException. Use an explicit stack that catches per directory, and report a denied count.")
fi

# SH-9 - measured: reported a 16.4 GB pagefile as absent, and Recycle.Bin as 0 MB.
# Narrow to an actual drive ROOT or a system location. An ordinary project path does not need
# -Force, and matching any Windows path fired on C:\Users\USER\Desktop\myproject - caught in the
# negative-branch test before this shipped (verify-fanout section 9).
# Accept one OR more backslashes: the live payload arrives JSON-escaped while a hand-written
# fixture may carry a single one, and an earlier test passed against a payload the hook would
# never actually receive.
if hasre 'Get-(ChildItem|Item)' && ! has '-Force'; then
  if hasre '[A-Za-z]:(\\+|/)([^A-Za-z0-9\\]|$)' || has 'Recycle' || has 'pagefile' || has 'hiberfil'; then
    findings+=("[SH-9] Enumerating a drive root or system location without -Force hides Hidden+System files such as pagefile.sys. Add -Force.")
  fi
fi

# SH-10 - measured: reported a 764-line file as 480 lines
if has 'Measure-Object' && has '-Line'; then
  findings+=("[SH-10] Measure-Object -Line does not count blank lines. Use (Get-Content file).Count.")
fi

# SH-1 - measured: the repeated cause of stopped runs was Korean text inside python -c.
# Non-ASCII arrives either as raw UTF-8 or JSON-escaped as \uXXXX; accept both rather than
# assume which. The escape branch matches any code point at or above U+0080.
if has 'python -c'; then
  if hasre '[^[:print:][:space:]]' \
     || hasre '\\u(00[89a-fA-F]|0[1-9a-fA-F][0-9a-fA-F]|[1-9a-fA-F][0-9a-fA-F]{2})[0-9a-fA-F]'; then
    findings+=("[SH-1] Do not put non-ASCII text inside python -c. Write a .py file and run it.")
  fi
fi

total=${#findings[@]}
[ "$total" -eq 0 ] && exit 0

# Cap the injection. More than three at once means the command needs rewriting, not annotating.
msg=""
count=0
for f in "${findings[@]}"; do
  count=$((count + 1))
  [ "$count" -gt 3 ] && break
  if [ -z "$msg" ]; then msg="$f"; else msg="$msg  ///  $f"; fi
done
[ "$total" -gt 3 ] && msg="$msg  ///  ($total patterns matched, 3 shown)"

# The messages are fixed ASCII strings with no quotes or backslashes, so this is safe to
# assemble by hand. Never interpolate the command itself here.
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}\n' "$msg"
exit 0
