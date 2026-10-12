#!/usr/bin/env bash
# skill-gate.sh - loads the right skill at the moment it is needed (CLAUDE.md section 1).
#
# Why (measured 2026-10-12 over 79 sessions): the skill a moment needed had been read before
# that moment in only 19% of agent launches, 40% of code edits and 43% of git commits. The
# routing table and "read the skill first" were text, and text was skipped. This hook blocks
# the first such action of a segment until the skill is read, and only once, so a broken
# ledger can never stall the work.
#
# Moments and skills (the same mapping the measurement used):
#   git commit (Bash/PowerShell)                    -> work-rules-shell
#   Agent / Task / Workflow                         -> agent-ops
#   Edit / Write on a code file, outside scratchpad -> work-rules-diagnosis
#   hwpx / hwp / pptx / docx / xlsx in path or cmd  -> work-rules-docs
#
# Modes:
#   check   PreToolUse   deny once per segment if the needed skill is not in the ledger
#   record  PostToolUse  Skill call or Read of a SKILL.md adds that skill to the ledger
#   reset   SessionStart compact / clear empties the ledger (a summary is not the skill body)
#
# Subagent calls (payload carries agent_id) are never gated: they cannot load the session's
# skills, and their prompt carries the rules (agent-ops AO-15).
# Bash built-ins only on the check path; no backslashes in this file (work-rules-shell SH-33).

export LC_ALL=C
q='"'
mode=${1:-check}
IFS= read -r -d '' payload

# value of "key":"..." or "key": "..."
field() {
  local r=${payload#*${q}$1${q}:}
  [ "$r" = "$payload" ] && return 1
  r=${r# }
  r=${r#${q}}
  printf '%s' "${r%%${q}*}"
}

session=$(field session_id) || session=nosession
session=${session//[^A-Za-z0-9_-]/}
dir="$HOME/.claude/cache/skillgate"
loaded="$dir/$session.loaded"
denied="$dir/$session.denied"
mkdir -p "$dir" 2>/dev/null

if [ "$mode" = "reset" ]; then
  : > "$loaded" 2>/dev/null
  : > "$denied" 2>/dev/null
  exit 0
fi

tool=$(field tool_name)

if [ "$mode" = "record" ]; then
  name=""
  if [ "$tool" = "Skill" ]; then
    name=$(field skill)
    name=${name##*:}
  elif [ "$tool" = "Read" ]; then
    path=$(field file_path)
    case "$path" in
      *skills*SKILL.md)
        name=${path##*skills}
        name=${name%SKILL.md}
        name=${name//[^a-z0-9-]/}
        ;;
    esac
  fi
  [ -n "$name" ] && printf ' %s ' "$name" >> "$loaded"
  exit 0
fi

# ---- check ----
[[ $payload == *${q}agent_id${q}* ]] && exit 0

need=""
moment=""
docre='[.](hwpx|hwp|pptx|docx|xlsx)'
case "$tool" in
  Bash|PowerShell)
    re='git[^|;&]*[[:space:]]commit'
    if [[ $payload =~ $re ]]; then
      need=work-rules-shell; moment="git commit"
    elif [[ $payload =~ $docre ]]; then
      need=work-rules-docs; moment="document file command"
    fi
    ;;
  Agent|Task|Workflow)
    need=agent-ops; moment="agent launch"
    ;;
  Edit|Write|MultiEdit)
    path=$(field file_path)
    case "$path" in
      *[Ss]cratchpad*) ;;
      *.py|*.ts|*.tsx|*.js|*.mjs|*.cjs|*.astro|*.sh|*.ps1|*.css|*.java|*.go|*.rs|*.c|*.cpp|*.h)
        need=work-rules-diagnosis; moment="code edit" ;;
      *.hwpx|*.hwp|*.pptx|*.docx|*.xlsx)
        need=work-rules-docs; moment="document file edit" ;;
    esac
    ;;
esac
[ -n "$need" ] || exit 0
[ -f "$HOME/.claude/skills/$need/SKILL.md" ] || exit 0

have=""
[ -f "$loaded" ] && have=$(<"$loaded")
[[ $have == *" $need "* ]] && exit 0

was=""
[ -f "$denied" ] && was=$(<"$denied")
[[ $was == *" $need "* ]] && exit 0
printf ' %s ' "$need" >> "$denied"

reason="[skill-gate] Read the $need skill in full before this $moment (CLAUDE.md section 1), then retry. Blocks once per segment."
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}' "$reason"
exit 0
