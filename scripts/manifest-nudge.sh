#!/usr/bin/env bash
# Fires after a SKILL.md write, and speaks only when that skill has actually drifted:
#   - its header range (Rules: X-1..X-N) disagrees with manifest.json ruleIds
#   - the highest X-n in its body disagrees with the header
#   - its size is past its byte budget (manifest warnBytes, else 20000)
#
# Why it exists (measured 2026-08-03): three skills had their own header corrected while
# manifest.json still declared the previous range, and only the SessionStart validator
# caught it a session later. Why it checks instead of always reminding (measured
# 2026-10-12): the unconditional version fired on every one of ~20 SKILL.md edits in one
# session, none of which changed a rule count, and a reminder that always fires is a
# reminder that gets skipped (work-rules-automation AU-22).
#
# Reminder, not a gate: it never denies. Messages are one sentence plus the rule ID (AU-24).
# No backslashes in this file on purpose (work-rules-shell SH-33); quotes come from $q.

export LC_ALL=C
q='"'

IFS= read -r -d '' payload
# Accept "file_path":"..." and "file_path": "..." alike.
rest=${payload#*${q}file_path${q}:}
[ "$rest" = "$payload" ] && exit 0
rest=${rest# }
rest=${rest#${q}}
path=${rest%%${q}*}

case "$path" in
  *skills*SKILL.md | *skills*SKILL.MD) ;;
  *) exit 0 ;;
esac

# skills/<name>/SKILL.md -> <name>; separators may be / or escaped backslashes.
name=${path##*skills}
name=${name%SKILL.*}
name=${name//[^a-z0-9-]/}
[ -n "$name" ] || exit 0

file="$HOME/.claude/skills/$name/SKILL.md"
manifest="$HOME/.claude/manifest.json"
[ -f "$file" ] && [ -f "$manifest" ] || exit 0

content=$(<"$file")
re='Rules: ([A-Z]+)-1[.][.][A-Z]+-([0-9]+)'
[[ $content =~ $re ]] || exit 0
prefix=${BASH_REMATCH[1]}
top=$((10#${BASH_REMATCH[2]}))

m=$(<"$manifest")
seg=${m#*${q}name${q}: ${q}${name}${q}}
[ "$seg" = "$m" ] && exit 0
seg=${seg%%${q}name${q}:*}

msgs=()

re='"ruleIds": "[A-Z]+-1[.][.][A-Z]+-([0-9]+)"'
if [[ $seg =~ $re ]]; then
  mtop=$((10#${BASH_REMATCH[1]}))
  if [ "$mtop" -ne "$top" ]; then
    msgs+=("[G-27] $name header declares $prefix-1..$prefix-$top but manifest.json ruleIds ends at $prefix-$mtop; update both in this change.")
  fi
fi

max=0
s=$content
re="$prefix-([0-9]+)"
while [[ $s =~ $re ]]; do
  n=$((10#${BASH_REMATCH[1]}))
  [ "$n" -gt "$max" ] && max=$n
  s=${s#*"${BASH_REMATCH[0]}"}
done
if [ "$max" -ne "$top" ]; then
  msgs+=("[VF-13] $name body cites up to $prefix-$max but its header declares $prefix-$top.")
fi

warn=20000
re='"warnBytes": ([0-9]+)'
[[ $seg =~ $re ]] && warn=${BASH_REMATCH[1]}
size=${#content}
if [ "$size" -gt "$warn" ]; then
  msgs+=("[DG-5] $name is $size bytes, past its $warn budget; answer DG-5 in manifest warnBytesReason rather than raising it silently.")
fi

[ ${#msgs[@]} -eq 0 ] && exit 0
out=""
for x in "${msgs[@]}"; do
  [ -n "$out" ] && out="$out  ///  "
  out="$out$x"
done
printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}' "$out"
