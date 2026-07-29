#!/usr/bin/env bash
# brief-nudge.sh
# Reminds the model to consider a verify-fanout brief before editing a file it did not write
# in this session (CLAUDE.md G-10, verify-fanout VF-7..VF-10).
#
# This is a SUGGESTION, not a gate. It does not deny the edit and it does not run an agent -
# a script cannot spawn one. It puts the reminder in front of the model at the moment of the
# edit and lets the model judge, which is the whole point: the failure being fixed is
# forgetting, not disagreeing.
#
# Two modes:
#   check   PreToolUse  Write|Edit   suggest a brief if this file is new to the session
#   record  PostToolUse Write|Edit   remember that this session has now touched the file
#
# Why the ledger: without it the nudge fires on every edit including files just created in
# this turn, and a reminder that is always on is a reminder that gets skipped (AU-22).
#
# Never blocks: always exits 0.

export LC_ALL=C
mode="${1:-check}"

raw="$(cat 2>/dev/null)"
[ -z "$raw" ] && exit 0

# Minimal field extraction. No jq on this machine, and these two fields are flat strings.
session=""
[[ $raw =~ \"session_id\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]] && session="${BASH_REMATCH[1]}"
[ -z "$session" ] && session="nosession"

path=""
[[ $raw =~ \"file_path\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]] && path="${BASH_REMATCH[1]}"
[ -z "$path" ] && exit 0
# JSON doubles every backslash; undo that so the path can be tested on disk.
path="${path//\\\\/\\}"

ledger_dir="$HOME/.claude/cache/brief"
ledger="$ledger_dir/$session.txt"

if [ "$mode" = "record" ]; then
  mkdir -p "$ledger_dir" 2>/dev/null
  printf '%s\n' "$path" >> "$ledger" 2>/dev/null
  exit 0
fi

# ---- check mode ----

# A file that does not exist yet cannot be briefed - there is nothing there to know about.
[ -f "$path" ] || exit 0

# Already touched in this session, so it was authored here. No brief needed.
if [ -f "$ledger" ] && grep -qxF -- "$path" "$ledger" 2>/dev/null; then
  exit 0
fi

# Skip the places where a brief is meaningless: scratchpad scratch files and this config repo's
# own bookkeeping. Editing a skill still gets nudged - that is exactly the case it is for.
case "$path" in
  *[Ss]cratchpad*|*/cache/*|*\\cache\\*|*.log|*.tmp) exit 0 ;;
esac

# The path is interpolated into a JSON string, so its backslashes and quotes have to be
# escaped. A Windows path emitted raw produces \U and \. which are invalid escapes, and an
# unparseable hook payload is dropped silently - the reminder would simply never appear.
esc="${path//\\/\\\\}"
esc="${esc//\"/\\\"}"

msg="[G-10] This session has not written ${esc} yet. Consider a verify-fanout brief before editing it - one agent, 3-5 decision-shaped lines on what already exists, what not to rebuild, and what this must agree with. Skip it if the change is obviously local and you already know the file."

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}\n' "$msg"
exit 0
