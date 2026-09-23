# caveman — sources, rationale and tests for CM-1..CM-28

Companion to `SKILL.md`. The rule text lives in `SKILL.md` and only there; this file adds
source, rationale and test per ID and records the operator setup. The split exists because
the SessionStart hook injects the whole of `SKILL.md` into context every time a level is
active, and rationale would cost tokens in the one file whose job is to save them. This file
is never injected.

Forked from JuliusBrussee/caveman v2.7.0 (MIT) on 2026-09-23. Upstream line numbers below
refer to that version's `skills/caveman/SKILL.md`.

## Editing SKILL.md — read this first

`caveman-config.js:765-787` filters `SKILL.md` line by line before injecting it, and drops
anything that belongs to a different level. Two patterns are destructive:

| Pattern | Effect |
|---|---|
| a line matching `^\|\s*\*\*(\S+?)\*\*\s*\|` | kept only when the bold first cell equals the active level |
| a line matching `^- (\S+?):\s` | kept only when the word before the colon equals the active level |

So in `SKILL.md`:

- never start a line with `- word: ` unless `word` is a level name and the line is an example
- never write a table whose first cell is `| **something** |` except the Intensity table
- a rule written as `- **CM-1**: text` is silently deleted at injection; `**CM-1** text` is safe
- every example block needs one line per level, or that level gets a header with nothing under it

`scripts/check-inject.js` in the scratchpad pattern proves this: it calls `loadFilteredRuleset`
for all seven level strings and reports which CM ids survive. Run something equivalent after
any structural edit. Measured 2026-09-23 on this fork: 28 of 28 rules survive at every level,
3 example lines and 1 table row per level, no orphan headers.

`canonicalModeLabel` maps the stored alias `wenyan` onto `wenyan-full`, so there is no
`| **wenyan** |` row and there should never be one.

## Operator setup

The starting level is resolved by `caveman-config.js:118-138`, in this order:

1. the `CAVEMAN_DEFAULT_MODE` environment variable
2. a repo-local `.caveman/config.json` or `.caveman.json`, walked up from the session cwd, 64 levels max
3. the user config file
4. the built-in default, `full`

The user config path is **platform-dependent** (`caveman-config.js:50-61`), and upstream's
`caveman-help/SKILL.md` documented only the POSIX one, which is why a Windows user following
it creates a file nothing reads:

| Condition | Path |
|---|---|
| `XDG_CONFIG_HOME` set | `$XDG_CONFIG_HOME/caveman/config.json` |
| Windows | `%APPDATA%\caveman\config.json` |
| otherwise | `~/.config/caveman/config.json` |

This install pins `{"defaultMode": "off"}` there, so a session starts normal and `/caveman`
turns compression on for that session only. That file sits outside the `~/.claude` repo and
does not travel with a clone; a fresh machine falls back to the built-in `full`.

## What this fork changed, and why

| Change | Reason |
|---|---|
| Rules given IDs and a count header | Nothing in upstream was citable, so a later edit could reverse a rule silently. The count is now declared in `manifest.json` as `ruleIds`, and `check-manifest.ps1:113-127` compares it against the body's highest id at every session start. That is the failure signal the documentation never had. |
| Body rewritten in plain English | Upstream wrote the instruction itself in caveman. Upstream line 19 packed seven unrelated rules into one 130-word run-on. The three best-written files in the package (`caveman-commit`, `caveman-review`, `cavecrew`) are the three written in plain English. |
| Abbreviation ban lists merged | Upstream line 19 listed `cfg/impl/req/res/fn`, line 46 listed the same plus `auth`. One rule, two places, already drifted, inside a single file. |
| Filler lists merged | Upstream `caveman/SKILL.md:19` listed five items, `caveman-compress/SKILL.md:40` listed seven. Same drift, across two files. |
| Arrows removed from the prose | Upstream banned causal arrows in CM-7's ancestor and then used `→` at its own lines 19, 25 and 33. |
| `/caveman wenyan` documented | `VALID_MODES` accepts it and `canonicalModeLabel` folds it into `wenyan-full`, but upstream's switch list omitted it while its README advertised it. |
| Third example block, Korean | See CM-23. A rule that is only stated is followed less reliably than a rule that is also shown. |
| `wenyan-lite` example added to the pooling block | Upstream had no `wenyan-lite` line there, so at that level the block injected as a header with nothing under it. |
| CM-21 added | Upstream's language rule said never switch language, and its wenyan levels switch language. The contradiction was unresolved. |
| Korean rules added (CM-22..CM-25) | Upstream reached "particles are grammar, not filler" and stopped. It has no notion of 음슴체 or 개조식. |

Unsourced numbers were not carried over. Upstream's `caveman-help/SKILL.md` advertised
"~46% input tokens" and `README.md` "65-75% of output tokens", while `caveman-stats/SKILL.md`
in the same package says savings are unknown and forbids inferring a percentage. The 46%
traces to five fixtures in `caveman-compress/README.md:42-47` and is a property of compressed
output, not of session input.

One measured finding was deliberately **not** imported. `work-rules-writing` WR-17 records that
Korean prose at zero 정도부사 reads flat, with a measured human baseline of 3.5-6.6 per 1,000
characters. That baseline comes from 자소서 and 회고 corpora, which is narrative prose read by
a person deciding something. A terse technical reply is a different genre, and there 정도부사
are exactly the filler CM-1 removes. Do not add a "keep some 정도부사" rule here on the strength
of WR-17.

## Known upstream defects, recorded and deliberately not fixed

The hook runtime in `~/.claude/hooks` is vendored unchanged and verified against upstream's
`checksums.sha256`, 9 of 9 matching at install. Editing it breaks that property: the checksums
stop matching and every future update becomes a manual merge instead of a copy. Everything below
is real, is upstream's to fix, and changes no behaviour today. It is recorded so a later session
does not rediscover it and does not "improve" the vendored files.

| Defect | Location | Why it is left |
|---|---|---|
| `INDEPENDENT_MODES` defined three times | `caveman-parse.js:53`, `caveman-mode-tracker.js:102`, `caveman-activate.js:335` | All three hold the same values. The activate.js copy is not a fallback, it is a third always-used literal, and nothing ties them together the way a test ties `FALLBACK_VALID_MODES` to `VALID_MODES`. If they ever drift, upstream drifts them, and a local patch is overwritten at the next refresh. |
| `'.caveman-active'` hardcoded in three files | `caveman-activate.js:143`, `caveman-mode-tracker.js:106`, `caveman-stats.js:73` | `caveman-config.js:803` exports `FLAG_BASENAME` for exactly this and nobody imports it. The strings are identical today. |
| Nine `caveman-config.js` exports with no importer | `getConfigDir`, `getConfigPath`, `findRepoConfigPath`, `safeDeleteFlag`, `SESSIONS_DIRNAME`, `FLAG_BASENAME`, `PREV_BASENAME`, `sessionsDir`, `sessionPrevPath` | Scoped to the five files installed here. The wider upstream repo may consume them, so unused is not dead. |
| Three failure philosophies for one dependency | `caveman-activate.js` and `caveman-mode-tracker.js` degrade in place; `caveman-stats.js:64` calls `process.exit(1)` | A real inconsistency, but each is defensible alone and picking one is an upstream design call. |
| `removeFlag` drops the symlink check that `safeDeleteFlag` has | `caveman-activate.js:146` and `caveman-mode-tracker.js:127`, against `caveman-config.js:292` | Reachable only when a stale `caveman-config.js` passes the shape check but lacks `writeSessionMode`. Narrow, and fixing it means editing the file this install refuses to fork. |

One audit claim did **not** survive checking, and the correction matters more than the claim. A
subagent reported that the two hooks degrade asymmetrically, with `caveman-mode-tracker.js:66`
falling back to a bare `() => 'full'` while `caveman-activate.js:134-140` mirrors the full
resolution order, and concluded that a missing sibling could override this install's
`defaultMode: off`. It cannot. In the degraded state `readFlag` returns null, so `activeMode` is
null and the only call site short-circuits at `caveman-mode-tracker.js:358` before `getDefaultMode`
runs. The `VALID_MODES: []` degrade is unreachable for the same reason, because `parseModeChange`
is stubbed to null and the branch that uses it never opens. The comment at
`caveman-mode-tracker.js:56-60` says exactly this and is correct, and `caveman-activate.js:76-81`
states the principle the audit was reaching for. Do not "fix" either stub.

## CM-1..CM-28

| ID | Source | Rationale | Test |
|---|---|---|---|
| CM-1 | upstream :19, merged with `caveman-compress` :40 | The bulk of the saving, and the only part with no downside. | Ask a question that invites a preamble. Grep the reply for "just", "basically", "certainly", "happy to". |
| CM-2 | upstream :19, :31 | Articles carry no role in English. See CM-22 for why this cannot generalise. | English reply at `full` contains no standalone "the" or "a". |
| CM-3 | upstream :19 | A fragment is unambiguous when the subject is the thing just named. | Reply at `full` contains at least one verbless sentence and still parses. |
| CM-4 | upstream :19 | Narration and decoration are pure output with no information. | Reply contains no emoji and no "Let me now...". |
| CM-5 | upstream :19 | A full log is the largest single block of wasted output in a debugging reply. | Ask about a failing command. The reply quotes one line, not the stack. |
| CM-6 | upstream :19 and :46, merged | The tokenizer splits an invented abbreviation into the same tokens as the word, so the saving is zero and the decode cost is real. This one is counterintuitive, which is why the rationale stays inline in `SKILL.md`. | Reply at `ultra` contains no `cfg`, `impl`, `req`, `res`, `fn`, `auth` as prose words. |
| CM-7 | upstream :19, :46 | An arrow is its own token. Same argument as CM-6. | No `→` anywhere in a reply at any level. |
| CM-8 | upstream :21 | A dropped negation inverts the answer. No token count justifies that. | Compress a sentence containing "not" and "only"; both survive. |
| CM-9 | upstream :19, :21 | These are the payload. Compressing them destroys the thing the reply exists to deliver. | An error string in the reply matches the source byte for byte. |
| CM-10 | upstream :23 | The failure mode of every compression style is performing the style. Measured by upstream: "when it not" costs one more token than "when not". | Reply contains no inserted pronoun or copula that the plain phrasing would not have. |
| CM-11 | upstream :23 | The general form of CM-2, CM-6 and CM-7. Without it each of those gets applied past the point where it saves anything. | "sees" is not mangled to "see" in a reply at `full`. |
| CM-12 | upstream :25 | ASD-STE100. Fragment ambiguity rises with sentence length, and compression already removes the connectives that would resolve it. | No sentence in a reply exceeds 20 words. |
| CM-13 | upstream :25 | Passive voice costs an auxiliary and hides the actor. | No "is performed by" constructions. |
| CM-14 | upstream :25 | Synonym rotation makes the reader re-identify the referent, which is the cost CM-6 is also about. | A reply naming a component uses one name for it throughout. |
| CM-15 | upstream :25 | An imperative is shorter than a recommendation and states who acts. | Instructions read "Run X", never "X should be run". |
| CM-16 | upstream :25 | A four-word noun cluster has to be parsed; a pronoun with two referents has to be guessed. | No noun cluster over 3 words. |
| CM-17 | upstream :25 | The tie-break that keeps every other rule from being applied to the point of damage. | A reply that would have been ambiguous is written long instead. |
| CM-18 | upstream :27 | Tool-call narration is output the user did not ask for and the transcript already shows. | A multi-call turn emits no text between calls except a warning or a clarification. |
| CM-19 | upstream :29 | Switching language is the largest possible failure of a style rule; it makes the reply unreadable rather than terse. | A Korean session with an English code sample stays Korean. |
| CM-20 | upstream :29 | A partially compressed session, where status lines revert to English, reads as a bug. | Pre-tool status lines are in the session language. |
| CM-21 | new; resolves the contradiction between upstream :29 and the wenyan levels | Upstream forbade switching language and then shipped three levels that switch language, with nothing saying which wins. | `/caveman full` in a Korean session produces Korean, not 文言文. |
| CM-22 | upstream :31 | Korean word order is free and 조사 carry the role, so dropping them removes information rather than padding. The English rule does not generalise. | "행마다 쿼리 1회 추가 발생" keeps 마다; it does not become "행 쿼리 1회 추가". |
| CM-23 | `work-rules-writing` WR-7, user directive 2026-09-23 | Korean already has a named compression register. Inventing a broken-Korean style would be CM-10 in Korean. 음슴체 also drops the longest part of a Korean sentence, the 종결어미. | Every sentence in a Korean reply at `full` ends in ~ㅁ, ~함 or a noun. |
| CM-24 | new, from WR-7's distinction | 반말 is shorter by roughly nothing and changes the relationship with the reader instead of the length. It is the Korean form of performing the style. | No "~다" or "~해" sentence endings in a Korean reply. |
| CM-25 | WR-3, WR-4, WR-8, and WR-17's punctuation measurement | WR-17 measured 줄표, 가운뎃점, 콜론 and 세미콜론 at zero occurrences across 10,682 characters of human Korean prose, so they read as machine-written. 한자 병기 is the same signal. | A Korean reply contains no `—`, no `·`, no `→`, no parenthetical hanja. |
| CM-26 | upstream :33 | An announcement, a prefix and a recap are three ways of spending output to say that output is being saved. | The reply starts with the answer. |
| CM-27 | upstream :68-77 | The cases where a misread costs more than the whole session's token saving. | A destructive-command answer is written in normal prose with the warning intact. |
| CM-28 | upstream :88 | Everything here outlives the chat and is read by someone who never set a caveman level. | A commit message generated in `ultra` is normal prose. |
