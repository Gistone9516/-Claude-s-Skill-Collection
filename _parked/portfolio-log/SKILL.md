---
name: portfolio-log
description: Look back over what the user studied and built today across all Claude Code sessions on this machine, pick out the parts where something went wrong or had to be decided, and write a private Korean study note for their portfolio - the user chooses how deep each issue goes. Use when the user asks to record or wrap up today, e.g. "오늘 기록", "오늘 일지 써줘", "오늘 공부 정리", "어제 것 기록해줘", "/portfolio-log". Not for the Discord learning bot (that is learning-harness). Stage 1 is private only; it never publishes.
---

# portfolio-log — today's issues, looked back on, as a study note

Rules: PL-1..PL-19 (19). Code and tests live beside this file (`scripts/plog.py`, `tests/test_plog.py`); each rule's Test column names a test there or says `manual`. The candidate format is shared with the work-panel mod (`~/.claude/mods/work-panel`, P-10, P-11), so a change to either side lands in the same commit.

Purpose: a portfolio record built by looking back, with the user, at the parts of the day where there was an issue ("포트폴리오 작성을 위한 - 오늘 배운 내용 중 이슈가 있었던 파트를 다시 회고함", 2026-10-11). It is not a review drill; quizzes and spaced repetition are out of scope ("순수 복습 수단은 당장은 필요없음").

All user-facing output is Korean (CLAUDE.md G-01). This body is English because it is read by the model.

## Rules

| ID | Rule | Source | Why | Test |
|---|---|---|---|---|
| PL-1 | A day runs from `day_start` (default 05:30 KST) to the next `day_start`, and is named after the date it starts on. | User, 2026-10-11: "공부를 오후 11시59분 넘어서 00시가 되서도 넘게 하는 경우가 많거든. 당장은 05시30분을 기준으로 하자." `day_start` is in config so it can move. | Midnight would split one night of study across two notes. | `test_window_after_midnight` |
| PL-2 | Log timestamps are UTC (`...Z`); convert before comparing. | Measured 2026-10-11: a session started 08:49 KST is logged `2026-10-10T23:49Z`. | Comparing raw strings files the morning under the previous day. | `test_utc_conversion` |
| PL-3 | Read only `projects/<slug>/*.jsonl`; skip `subagents/` and `isSidechain` lines. | Measured 2026-10-11: 259 subagent transcripts beside 337 session files. | Agent transcripts repeat the main session and would drown it. | `test_sidechain_excluded` |
| PL-4 | Group by the `cwd` field, case- and separator-insensitive, never by slug folder name. | Measured 2026-10-11: slugs differing only in drive-letter case (`C--`, `c--`) coexist for one folder. | Grouping by slug splits one project in two. | `test_cwd_merge` |
| PL-5 | Lines without a timestamp are ignored; file mtime only pre-filters candidates. | Measured 2026-10-11: 273 of 1288 lines in one file had no timestamp. | mtime says when a file was last touched, not when each line happened. | `test_no_timestamp_ignored` |
| PL-6 | Keep: what the user typed, the last answer text of each turn, edited file paths, and git commits in the window. Drop thinking, tool output, `isMeta` skill injections, task notifications, system reminders. | Measured 2026-10-11 over 15 recent sessions: 1030 tool-result lines against 236 typed inputs. | The digest is read by the model; noise costs tokens and buries the issues. | `test_turn_extraction` |
| PL-7 | Secrets are masked at collection time, before anything is written. | Design, 2026-10-11. | The note is the source for later public posts; a key that reaches the digest can reach a post. | `test_masking` |
| PL-8 | A folder seen for the first time is asked about: record it? public? where should it go (TIL / that project's README / both)? The answer is stored with `set-folder`. Folders set to `record: no` leave no content in the digest. | User, 2026-10-11: "그건 이 스킬을 폴더에서 처음 쓸때 범위를 물어보는 걸로 정하자." Interpreted as covering both inclusion and destination; say so if the user questions it. | Some folders (자소서, personal documents) must never feed a public note. | `test_excluded_folder` |
| PL-9 | Before writing, list issue candidates from the digest and let the user mark each one **깊게**, **짧게** or **빼기**, and add what is missing. Signals of an issue: a failed test or error, the same attempt repeated, a decision reversed, the AI corrected, the user unhappy ("느리네", "별로", "왜 안 돼"), and edited files or commits that nothing in the list explains. Wait for the marks. | User, 2026-10-11: "오늘 배운 내용을 어디까지 기입할건지 사용자에게 선택지로 묻기", and "비중 깊게 다룰 내용이 아닌 것들은 가능한 짧게 핵심만". | Left to itself the model weighs a topic by how long it was discussed; a long but minor detour (a model swap that was tested at length) came out longest. | manual |
| PL-10 | Never invent a motive, cause, lesson or view. What the user said or accepted in the session is theirs to write; anything else is asked once, and "없음/모름" means leave it out. A cause that was reasoned but not measured is written as reasoned (「~으로 분석」, 「~으로 추정」). | CLAUDE.md G-29; the user's short-form example marks its cause 「~때문으로 분석」. | A first-person note with an invented reason is a false record in the user's voice, and an unmeasured cause written as fact does not survive an interview question. | manual |
| PL-11 | The note takes the study-note form of `work-rules-writing` WR-2: write like `~/.claude/skills/work-rules-writing/reference/exemplar-til-approved.md`, and write every **짧게** item in that file's short form. Retrospective content (attempts, cause, evidence, the user's view, a better direction, file notes) goes in as indented lines under the item it belongs to, never as a section of its own. | User, 2026-10-11: "포트폴리오 자동화에는 공부 노트 서술을 가져갈거야" and "내용은 따로 섹션을 빼두는게 아니라, 개조식의 깊이에 덧붙이는 느낌으로만 다룰거야." | Separate retrospective sections turned a note into a form to fill; depth under the item keeps the issue and its look-back together. | manual |
| PL-12 | After the draft, two review agents each read the whole draft, the material it came from and the exemplar, and return overall feedback plus a full rewrite. The main session merges with judgement. | User, 2026-10-11: "최소한의 명령을 주입한 에이전트 2대를 띄워 문맥 흐름 및 타당성을 비판" and "전체적으로 조화를 보고 전체적인 피드백, 전체적으로 재작성해서 메인 AI에게 돌려주는거야." The user specified these two agents, so they need no per-run approval (G-22); count them in the report. | A single writer cannot see its own stitched prose; two independent rewrites show what a natural version looks like. | manual |
| PL-13 | Stage 1 writes only to the private journal folder. No git push, no blog, no public repo. | User agreed 2026-10-11 to a two-tier design: private daily note, public posts later and by choice. | Research 2026-10-11 (anecdotal sources): daily automated public commits read as contribution-graph gaming. | manual |
| PL-14 | Script stdout is ASCII; Korean goes to files read with the Read tool. | `work-rules-shell` SH-12. | The console is cp949 and dies on Korean output. | by construction |
| PL-15 | For every item marked **깊게**, ask in one message what the user made of the issue and whether a better direction existed. Their answers become depth lines under the item, in their words. | User, 2026-10-11: "이런이런 이슈가 있었는데, 사용자의 견해는 어떤지 추가로 묻기" and "좀 더 나은 방향이 없었는지 되묻기". | The note is a look-back done together; the view and the road not taken are the parts only the user can supply. | manual |
| PL-16 | For code work, explain each edited file under the item it belongs to: what changed and why, in a line or two. Take the change from the window's git history (`git -C <cwd> log -p --since --until`) when there is one, otherwise from the session and the file itself. | User, 2026-10-11: "코드 작업에서는 수정된 파일 기준으로 해설 붙여 기재하기." | A portfolio reader checks claims against code; a note keyed to files makes that check possible. | manual |
| PL-17 | `plog.py errors [--days N]` lists the error moments of the last N days (default 30) across sessions: tool errors, blocked calls, user interruptions, and user corrections, each with the user request it happened under, plus the errors that repeated. Corrections are matched by wording and are candidates, never facts. PL-3, PL-7 and PL-8 apply. Output goes to `<journal>/errors/`. | User, 2026-10-12: "과거 세션에서도 에러 사항을 찾아주라." | Issues worth looking back on are not only today's, and a repeated error is a rule that is not working. The JSON keeps the `repeats` so the repeat count is computed in one place. | `test_errors_extraction` |
| PL-18 | `collect` adds a `## 기록 후보 (현황판에서 고름)` section: each entry of `<journal>/candidates.json` whose time falls in the day's window and is not yet used (PL-19), as a title line with time, project and session, then 요청, 의도, 문제, 결과, 가치, 근거 lines, masked (PL-7). An old entry with only `text` still renders. The work-panel mod writes that file when the person presses 후보 on a suggestion Claude posted with `portfolio_suggest` (work-panel P-10, P-11); field names must match its `Candidate` type. | User, 2026-10-12 (panel design) and 2026-10-13: "후보 패널에 추가된 내용은 추후 포트폴리오 스킬을 사용했을 때 읽게 하는거지", "후보 내용을 빠르게 인덱싱 하기 위해 … 세션 정보나 목적과 의도, 문제 정보 등 간략히 기록". | The candidates are picked during the day, so the look-back should not have to find them again, and the index lines let it place each one without re-reading the sessions. | `test_candidates_in_digest` |
| PL-19 | After the note is saved, run `plog.py candidates-used --date D`. It appends the ids of that day's candidates to `<journal>/candidates-used.json`; the panel then deletes them from `candidates.json`, and `collect` no longer lists them. Never at collect time, and never edit `candidates.json` from here. | User, 2026-10-13: "포트폴리오 스킬을 쓴 이후에는 후보에 있는 내용은 삭제되게 끔 하자고". After the save, and through a separate file, by design the same day. | Marking at collect would lose the candidates of a run abandoned halfway; two programs editing one file overwrite each other, so the panel stays the only writer of `candidates.json` (work-panel P-16). | `test_candidates_used_after_save` |

## Paths

- Script: `scripts/plog.py` beside this file. Run it with `python -I "<that path>" ...`.
- Journal folder: env `PORTFOLIO_JOURNAL_DIR`, else `~/portfolio-journal`. Run `plog.py paths` to print it.
- Config: `<journal>/config.json` (`day_start`, `tz_offset_hours`, `folders`).
- Form: the exemplar named in PL-11. If the user has put their own `<journal>/templates/daily.md`, it wins.
- Output: `<journal>/daily/YYYY-MM-DD.md`. Intermediate files: `<journal>/digest/`.

## Procedure

1. **Which day.** Default is the current logical day (PL-1). "어제" and explicit dates map to `--date YYYY-MM-DD`.
2. **Collect.** `python -I "<script>" collect [--date D]`. Read the printed summary, then the meta JSON.
3. **New folders (PL-8).** For every project with `status: new`, ask in one message, listing each folder path: record or not, public or not, destination `til` / `readme` / `both`. Store each answer with `set-folder`. If any folder became `no`, run collect again so its content leaves the digest.
4. **Read the digest** whole, in consecutive parts if long. Read the exemplar named in PL-11.
5. **Issue candidates (PL-9).** Reply with a numbered list per project, one line per candidate: what happened, and the signal that made it a candidate. Entries from the digest's `## 기록 후보` section come first, labelled as already picked on the panel; the rest are found in the digest as before. Every entry still gets a mark. Suggest a mark for each, and say the user decides. Then stop and wait for marks such as "1 깊게, 2 짧게, 3 빼기", plus anything they add.
6. **Go deeper (PL-15, PL-16).** In one message, for each 깊게 item, ask the user's view of the issue and whether a better direction existed. For code projects, gather each edited file's change. Wait for the answers.
7. **Draft (PL-11).** Write the note in the exemplar's form. Title states the day's conclusion; headings follow how the day moved. A 깊게 item carries its depth as indented lines: the attempts, the cause and how it was known (PL-10), the evidence with numbers, the user's view, the better direction, the file notes. A 짧게 item is the short form, two lines at most. A 빼기 item is left out.
8. **Review (PL-12).** Spawn two agents in one message, `model: "sonnet"`, each with the same prompt below. Give them the draft, the marked items with the user's answers, and the exemplar path; not the raw digest.

   ```
   Below is a Korean study note draft, followed by the material it was written from.
   Read the exemplar at ~/.claude/skills/work-rules-writing/reference/exemplar-til-approved.md
   first; it shows the form and feel the user wants.
   Read the whole draft and judge how it reads as a whole: whether it holds together the
   way the exemplar does, and whether what it says is supported by the material.
   Reply in Korean with two parts:
   1. 전체 피드백 - a few sentences on the draft as a whole.
   2. 재작성본 - the full note rewritten as you think it should read.
   Stay within the material. If something seems missing, say it in the feedback instead
   of adding it.
   ```
9. **Merge.** Read both rewrites and the feedback. Write the final version, taking what reads better from any of the three. Anything a rewrite adds that the material and the user's answers do not support is dropped or asked about (PL-10).
10. **Save.** Write `<journal>/daily/YYYY-MM-DD.md`. If it already exists, ask whether to replace it or add to it. Then run `python -I "<script>" candidates-used --date D` (PL-19). Report the path, the number of candidates marked used, and the agent count for this run (2).
