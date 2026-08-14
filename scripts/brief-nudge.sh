#!/usr/bin/env bash
# brief-nudge.sh
# Reminds the model to run the verify-fanout brief pair before editing a file it did not write
# in this session (CLAUDE.md G-10, verify-fanout VF-7..VF-10 and VF-21).
#
# The message stays one imperative sentence plus the rule ID (work-rules-automation AU-24). It
# named the shape of a brief until 2026-07-30, and when the rule changed to a pair that copy was
# left saying "one agent" - a hook that restates a rule is a second copy of it (VF-16).
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

msg="[G-10] First touch of ${esc} this session - run the verify-fanout brief pair (현장 + 주변, VF-21) before editing it, or say why you are skipping it."

# If this file has a decision note, name it. The note answers what the brief cannot: what earlier
# decisions cost, and what breaks if this edit reverses one (VF-22). Repo root is inferred by
# walking up to the directory holding _shadow, so this works from any depth.
dir="${path%[/\\]*}"
while [ -n "$dir" ]; do
  if [ -d "$dir/_shadow" ]; then
    rel="${path#"$dir"}"
    rel="${rel#[/\\]}"
    note="$dir/_shadow/$rel.md"
    if [ -f "$note" ]; then
      nesc="${note//\\/\\\\}"
      nesc="${nesc//\"/\\\"}"
      msg="$msg  ///  [VF-22] It has a decision note - read ${nesc} before editing."
    fi
    break
  fi
  next="${dir%[/\\]*}"
  [ "$next" = "$dir" ] && break
  dir="$next"
done

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s"}}\n' "$msg"
exit 0
