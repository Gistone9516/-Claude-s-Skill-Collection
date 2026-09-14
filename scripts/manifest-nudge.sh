#!/usr/bin/env bash
# Fires after a SKILL.md write. manifest.json declares each skill's ruleIds range, byte
# budget and role, and it does not update itself.
#
# Why this exists (measured 2026-08-03): ai-characteristics, work-rules-shell and
# new-hwpx-master each had a rule added. All three had their OWN header corrected
# (AI-1..AI-15, SH-1..SH-30, HX-1..HX-16) while manifest.json still declared the previous
# range. The drift is one-directional and silent: the body header looks authoritative, so
# nothing in the editing moment points at the second file. Only the SessionStart validator
# caught it, one session later.
#
# Reminder, not a gate. It never denies — a hook that blocks an edit over bookkeeping
# would be worse than the drift (work-rules-automation AU-22: a check that cries wolf is
# worth less than no check).
#
# Bash built-ins only, no forks — same constraint as pattern-guard.sh, measured there at
# 190 ms per call against 550 ms with one grep per pattern.

IFS= read -r -d '' payload

# file_path 값만 뽑는다. jq를 부르지 않는 이유는 위 주석의 포크 비용이다.
rest=${payload#*\"file_path\":\"}
path=${rest%%\"*}

# 경로 구분자가 Windows에서는 이스케이프된 역슬래시로 온다. 양쪽 다 견디게 느슨히 맞춘다.
case "$path" in
  *skills*SKILL.md | *skills*SKILL.MD) ;;
  *) exit 0 ;;
esac

printf '%s' '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"You just edited a SKILL.md. ~/.claude/manifest.json separately declares that skill'"'"'s ruleIds range, byte budget and role, and it does not update itself. If you added, removed or renumbered a rule: update BOTH the skill'"'"'s own header (Rules: X-1..X-N (N)) AND the matching ruleIds in manifest.json, in this same change. If the file grew past its declared warnBytes, answer work-rules-diagnosis DG-5'"'"'s responsibility question and record the answer in warnBytesReason rather than raising the number silently. Measured 2026-08-03: three skills had their own headers updated while the manifest still declared the old ranges, and only the SessionStart validator caught it a session later."}}'
