---
name: work-rules-automation
description: Robustness rules for automation, background Workflows and long multi-step runs - a catalogue of measured traps. One format error stops an entire run, so read this in full before firing a background Workflow, orchestrating agents, writing an automation script, or starting a long session. Triggers - Workflow 실행, 백그라운드 작업, 자동화 스크립트, 멀티스텝 런, 헬스체크, 팬아웃, background run, orchestration.
---

# work-rules-automation — automation and Workflow robustness

Rules: AU-1..AU-26 (26). Ordered by what a violation costs.
Delegation policy is in `agent-ops`; why these rules exist is in `ai-characteristics`. The `Workflow` tool description is canonical for script semantics; this file holds only traps it does not warn about or that were measured here.

**A single format error that halts a run is a critical defect.** One malformed tool call or one unguarded crash kills the whole automation.

## 1. Tool-call hygiene

**AU-1 One call at a time, format verified.** Confirm block closure and parameter shape before sending.

**AU-2 Response truncation produces a malformed call, the leading cause of a long session stopping silently** (AI-11). The cause is the total output of one response: long prose plus a long payload truncates the tool block, nothing executes, and it renders as plain text.

- Never put long prose and a long payload in the same response; at most one long payload per response.
- For a few lines of change, prefer a targeted Edit over rewriting the file.
- Never skip a correctness-critical step to save volume; only diagnostic extras may go.
- A tool call that appears as plain text with no result was truncated. Resend it alone and shorter.

## 2. Writing automation scripts

**AU-3 Wrap every automation script in per-stage try/except** so the output names the failed stage and why. Validate inputs at the start and outputs at the end, and delete partial files on failure so a broken artifact never looks finished.

**AU-4 Make it idempotent and resumable.** Re-running must not damage existing output; Workflow runs carry `resumeFromRunId`.

## 2-1. Writing a Workflow script

The script is plain JavaScript run by the orchestrator, and two constraints give no helpful error.

**AU-17 It is JavaScript, not TypeScript.** Type annotations, interfaces and generics are parse errors before a single agent spawns.

**AU-18 `Date.now()`, `Math.random()` and argless `new Date()` throw,** because a resumed run must reproduce the same call sequence. Pass timestamps through `args`, stamp results after the run, and vary by item index.

**AU-19 Scale the fan-out from the declared budget, not from a guess.** When a token target is set, size the loop or fleet from what remains, and guard on the target existing; without one, a naive loop runs to the agent cap.

**Barriers cost wall-clock.** Prefer a pipeline where each item flows through all stages independently. A barrier is right only when a stage needs cross-item context (deduplicating across all results, an early exit on a zero count, comparing findings); flattening or filtering is done inside a stage.

## 3. Running background Workflows

**AU-5 Health-check every 20 minutes (user directive 2026-06-22).** An agent can die quietly so the completion signal never arrives; measured, a run sat at N-1 of N with the work finished. Compare started-versus-result counts in the run's `journal.jsonl` against the modification times of the `agent-*.jsonl` files; past the threshold, recover the finished parts from the transcript and resume the rest with `resumeFromRunId`. Use `Monitor` or `ScheduleWakeup`; a detached bash sleep loop dies silently here.

**AU-6 No git stash / checkout / restore while parallel agents run** (`work-rules-shell` SH-7). Put "no git commands at all" in every parallel editing agent's prompt.

**AU-7 Subagents write files relative to cwd even when given an absolute path (measured 2026-06-24, AI-9),** so artifacts scatter and the repo root gets polluted.

**AU-8 Do not trust a workflow's own success signal (AI-8).**

1. When the run ends, audit the artifacts on disk: count, path, content. Gather what scattered.
2. Have a verification agent correct files in place, and still do not trust it.
3. **opus re-verifies by executing**: run the code natively or through a light runner (`tcc -run`, `javac` + `java -cp`, Python `sqlite3` for SQL); for output prediction, stdout is the answer whatever the exit code.
4. Final confidence comes from an end-to-end run with real code. Agents generate; deterministic execution proves.

**AU-9 When handing an agent an absolute path, also state the fallback**: "if that fails, write relative to the repo root and return the actual path."

## 4. Claude Code CLI "Continue from where you left off" auto-injection (measured 2026-06-25)

**AU-10** Ending a turn right after a tool use can make the harness inject `Continue from where you left off.` (anthropics/claude-code #44459). It is the CLI, not discord-bridge re-invoking. The model may then answer `No response requested.` and drop the tool result.

**AU-11 On receiving it, never end empty (user directive).** Give the answer that tool result was for, or restate the conclusion in one line if everything was done. Delete this section once the CLI fix lands.

## 5. `claude -p` session lifetime — no orphans (user directive 2026-07-21)

Wherever a script or server drives headless `claude -p` sessions, including multi-turn `--resume`:

- **AU-12 The code that opens a session owns its close and cleanup** (try/finally). Record spawned processes and session ids, kill hung processes on failure, timeout and exception paths, and clean up in a shutdown hook.
- No unbounded waiting: every call has a ceiling, and exceeding it means kill and report.
- A failed resume becomes a new session or an explicit error, never a retry loop on a lost id.

## 6. `claude -p` is an agent, not a completion API (measured 2026-07-21)

- **AU-13 With the default tool set it performs the work on disk.** Asked to "create a project", it created files, ran pytest and returned prose instead of the caller's JSON. Disable tools with `--tools ""` and also say in the prompt: no file creation, no tool use, JSON only.
- **AU-14 The `system` key in a stdin JSON payload is ignored**, so a safety preamble disappears silently. Prepend it to the user message body. stdin JSON carries newlines, quotes and Korean safely, unlike argv (`work-rules-shell` SH-13, SH-14).
- **AU-15 Check reachability with a sentinel** ("answer only BANANA") before relying on a preamble.

## 6-1. Writing a guard hook

**AU-21 A hook must not inspect state that the observed command is about to change; pick the event by what the check reads.**

| What the check reads | Correct event | Why |
|---|---|---|
| The command text itself | `PreToolUse` | Text does not change before execution, and a destructive command is worth stopping first |
| Mutable state the command will modify (index, working tree, a file) | `PostToolUse` | Read early, it gives a stale answer |
| An error signature that exists only after failure | `PostToolUseFailure` | Nothing in the input predicts it |

Measured 2026-07-29: a `PreToolUse` README check on `git add -A && git commit` read the index before `add` ran and flagged a commit that did contain the README; reading the landed commit `PostToolUse` made it exact.

**AU-25 Escape anything interpolated into a hand-built JSON hook response.** A raw Windows path produced invalid escapes, and an unparseable hook payload is dropped without error (measured 2026-07-30). Assert JSON validity in the test.

**AU-26 A script hook cannot spawn an agent.** The shapes available: a `type: agent` hook (no session context), a `command` hook that injects a reminder, or a `command` hook that denies until a precondition holds. Calling `claude -p` from a hook is a minefield (AU-13, AU-14).

**AU-24 A hook message is one imperative sentence plus the rule ID, never the rationale.** A restated rationale is a duplicate that goes stale, and a long injection at every firing reproduces the dilution hooks were meant to fix.

**AU-22 The selection criterion for a guard hook is zero false positives.** A hook that cries wolf gets ignored. A rule with no reliable mechanical signature stays in its skill; rejected on this basis: "no complex inline shell" (the threshold is a judgement) and predicting cp949 failures from command text (the violations had ASCII commands and non-ASCII data).

**AU-23 Cost the hook before registering it.** A PowerShell hook process cost 600-700 ms per call here. Narrow with `if` (prefix matching; see `work-rules-shell` SH-26) so the process never spawns for other calls, and use `asyncRewake` so a clean call costs nothing.

## 7. How this file changes

**AU-16** A lesson revises the rule it belongs to in one or two lines with its measured date (`ai-characteristics` AI-17); a new rule updates the header count.

**AU-20** Before adding a trap, check whether the tool description already documents it; record only what it does not say or what was measured differently here (`agent-ops` AO-1).
