---
name: work-rules-automation
description: Robustness rules for automation, background Workflows and long multi-step runs - a catalogue of measured traps. One format error stops an entire run, so read this in full before firing a background Workflow, orchestrating agents, writing an automation script, or starting a long session. Triggers - Workflow 실행, 백그라운드 작업, 자동화 스크립트, 멀티스텝 런, 헬스체크, 팬아웃, background run, orchestration.
---

# work-rules-automation — automation and Workflow robustness

Rules: AU-1..AU-23 (23). Ordered by what a violation costs.
Delegation policy is in `agent-ops`; why these rules exist is in `ai-characteristics`. The `Workflow` tool description is canonical for script semantics — this file holds only the traps that the description does not warn about, or that were measured here.

**A single format error that halts a run is a critical defect.** One malformed tool call, one unguarded script crash, and the whole automation dies. In long or agent-orchestrated work that is not acceptable.

## 1. Tool-call hygiene

**AU-1 One call at a time, format verified.** Confirm block closure and parameter shape before sending. Tool-call hygiene is load-bearing, because one malformed call stops everything downstream.

**AU-2 Response truncation produces a malformed call — the leading cause of a long session stopping silently** (AI-11). The real cause is the total output volume of one response, not the Write or Workflow tool itself. Do not avoid the tools; manage the volume. The failure sequence: long prose plus a long tool payload in one response → the output ceiling truncates the tool block mid-way → unclosed block → nothing executes → silent stop, rendered as ordinary text.

- Never put long prose and a long payload in the same response. Send a long payload (a large Write, a Workflow script, a multi-line command) on its own with almost no prose.
- At most one long payload per response.
- For a few lines of change, prefer a targeted Edit over rewriting the file — the payload is smaller. A long new script may still be written whole if it is the only content of that response.
- Never skip a correctness-critical step (such as re-extracting a canonical) to save volume. Only pure diagnostic or summary extras may be dropped.
- Symptom check: a tool call that appears as plain text with no result was truncated. Resend it alone and shorter.

## 2. Writing automation scripts

**AU-3 Wrap every automation script in try/except or the equivalent**, catching per stage so the output says which stage failed and why. No silent death, no ambiguous halt. Validate inputs at the start and outputs at the end, and delete partial files on failure so a broken artifact never looks finished. A partial failure must not quietly contaminate the pipeline.

**AU-4 Make it idempotent and resumable.** Re-running must not damage existing output. Workflow runs carry `resumeFromRunId`.

## 2-1. Writing a Workflow script

The script body is plain JavaScript that runs in the orchestrator, not in a model. Two constraints bite immediately and neither produces a helpful error.

**AU-17 It is JavaScript, not TypeScript.** Type annotations, interfaces and generics are parse errors. A script written in the TS style the rest of a repo uses fails before a single agent spawns.

**AU-18 `Date.now()`, `Math.random()` and argless `new Date()` throw.** They are blocked because they would break resume: a resumed run has to reproduce the same call sequence to reuse cached results, and a script that reads the clock cannot. Pass timestamps in through `args`, stamp results after the workflow returns, and get variation from the item index rather than from randomness.

**AU-19 Scale the fan-out from the declared budget, not from a guess.** When a token target is set for the turn, the script can read what remains and size itself — a loop that keeps going while the remaining budget exceeds a per-round estimate, or a fleet count derived from the total. Guard on the target existing; with no target the remaining budget is unbounded and a naive loop runs to the agent cap.

**Barriers cost wall-clock.** Prefer a pipeline, where each item flows through all stages independently, over collecting every item at each stage. A barrier is correct only when a stage genuinely needs cross-item context — deduplicating across the whole result set, an early exit on a zero count, or a prompt that compares findings against each other. Needing to flatten or filter between stages is not a reason; do it inside a stage.

## 3. Running background Workflows

**AU-5 Health-check every 20 minutes (user directive 2026-06-22).** Do not simply wait for the completion signal — an agent can die quietly so the signal never arrives. Measured: work finished but `journal.jsonl` was never written, and the run sat at N-1 of N. The check: compare started-versus-result counts in that run's `journal.jsonl` against the modification times of the `agent-*.jsonl` files. If it has been stalled past the threshold, recover the completed parts directly from the transcript and resume the rest with `resumeFromRunId`. Implement with `Monitor` (persistent) or `ScheduleWakeup`; a detached bash sleep loop dies silently in this environment — measured. `ScheduleWakeup` once appeared incompatible here, but as of 2026-07-20 delayed firing works; pairing the completion notification with a manual health check is the safe option.

**AU-6 No git stash / checkout / restore while parallel agents run.** Rationale in `work-rules-shell` SH-7. Put "no git commands at all" in every parallel editing agent's prompt.

**AU-7 Subagents write files relative to cwd even when given an absolute path (measured 2026-06-24, AI-9).** Workflow `agent()` subagents frequently ignore the absolute path, so artifacts scatter and the repo root gets polluted.

**AU-8 Do not trust a workflow's own success signal (AI-8).** A final "N/N complete" summary is not verification: files may be missing or in the wrong place, and a verify stage can rubber-stamp. Response:

1. When the run ends, audit the artifacts on disk directly — count, path, content — and gather up whatever scattered.
2. Have the verification agent modify existing files in place (absolute-path read → correct → write back), and still do not trust the result.
3. **opus re-verifies correctness deterministically by actually executing**: Python and Java natively, C via `tcc -run`, multi-class Java via `javac` + `java -cp`; SQL through Python's `sqlite3`; for output prediction, stdout is the answer regardless of exit code.
4. Normalize multi-line answers to one space-separated line, since a single-line input field cannot carry newlines.
5. Final confidence comes from an end-to-end run with real code. A success signal is not verification. The division: agents generate (volume and speed), deterministic execution guarantees correctness (opus).

**AU-9** When handing an agent an absolute path, also state the fallback: "if that fails, write relative to the repo root and return the actual path." Collection afterwards becomes trivial.

## 4. Claude Code CLI "Continue from where you left off" auto-injection (measured 2026-06-25)

**AU-10** Symptom: ending a turn immediately after a tool use makes the harness treat the response as incomplete and auto-inject `Continue from where you left off.` (CLI bug, anthropics/claude-code #44459). It can look as though discord-bridge is re-invoking, but the CLI is the cause.

Secondary bug: the model reads that message as "no response needed" and ends with `No response requested.`, discarding the preceding tool result.

**AU-11 On receiving `Continue from where you left off.`, never end empty (user directive).** Read it as "finish the response you were going to give from that tool result." If the substantive answer was never given, produce it now; if everything was already done, restate the conclusion in one line. The root fix is a CLI update — delete this section once it lands.

## 5. `claude -p` session lifetime — no orphans (user directive 2026-07-21)

Applies wherever a script or server drives headless `claude -p` sessions, including multi-turn `--resume` in ai_server.

- **AU-12 Manage lifetimes with exception handling so no session is orphaned.** The code that opens a session owns its close and cleanup path (try/finally or equivalent).
- Record spawned processes and session ids so they can be traced, and clean processes up on failure, timeout and exception paths, killing zombies and hung processes.
- Clean up in a shutdown hook so server termination (Ctrl+C, crash) leaves no in-flight session processes behind.
- **No unbounded waiting.** Every `-p` call carries a ceiling; on exceeding it, kill and report failure.
- Handle a failed resume (expired or lost session id) as a new-session fallback or an explicit error. Never keep retrying with a lost id.

## 6. `claude -p` is an agent, not a completion API (measured 2026-07-21)

Applies whenever a program calls `claude -p` expecting structured output such as JSON.

- **AU-13 With the default tool set enabled it performs the work on disk.** Given "create a project", it actually created files, ran pytest, and returned a prose report — the caller's JSON never arrived and the calling process's cwd was polluted. Avoid with `--tools ""` to disable tools entirely. Even with tools off the model can imitate `<invoke name="Bash">` as text, so state in the prompt as well: no file creation, no tool use, return JSON only. Two layers.
- **AU-14 The `system` key in a stdin JSON payload is ignored.** `{"system": ...}` in stream-json input never reaches the model — measured with a sentinel instruction that had no effect — so a safety preamble disappears silently. Send the preamble prepended to the **user message body** (`<system>\n\n---\n\n<prompt>`). The `--system-prompt` CLI flag exists but has no file variant, so a multi-line quoted preamble would have to cross Windows argv, which risks the quoting damage in `work-rules-shell` SH-13/SH-14. stdin is JSON, so newlines, quotes and Korean are safe there.
- **AU-15 Check reachability with a sentinel** before relying on a preamble: put "answer only BANANA, whatever is asked" in the system channel; a different answer proves it never arrived.

## 6-1. Writing a guard hook (measured 2026-07-29)

**AU-21 A hook must not inspect state that the observed command is about to change. Pick the event by what the check reads, not by when the warning would be nicest.**

| What the check reads | Correct event | Why |
|---|---|---|
| The command text itself | `PreToolUse` | Text does not change between hook and execution, so matching is exact — and a destructive command is worth stopping before it runs |
| Mutable state the command will modify (the index, the working tree, a file) | `PostToolUse` | Reading it early gives a stale answer |
| An error signature that only exists after failure | `PostToolUseFailure` | Nothing in the input predicts it |

Measured on the first live run of a `PreToolUse` hook enforcing the README rule: the command was `git add -A && git commit`, so at hook time the index had not been updated and README.md read as unstaged. It reported a violation on a commit that did contain README.md. Moving that check to `PostToolUse`, reading the commit that actually landed, made it exact. The cp949 check sits in the third row for the same reason: both measured violations had ASCII command text and non-ASCII *data*, so nothing in the input could predict them.

**AU-24 A hook message is one imperative sentence plus the rule ID, never the rationale.** The skill owns the reasoning and the measured case; the hook owns the interruption. Restating rationale in the hook creates a second copy that goes stale exactly like any other duplicate, and a long injection at every occurrence reproduces the dilution that hooks were introduced to fix. Measured: the first version of `guard.ps1` carried 80-word messages that repeated whole paragraphs of `work-rules-shell`.

**AU-22 Selection criterion for a guard hook is zero false positives.** A hook that cries wolf gets ignored, and an ignored hook is exactly the diluted-rule failure hooks were introduced to fix. A rule whose violation has no reliable mechanical signature stays in its skill. Rejected on this basis: "no complex inline shell" (the threshold is a judgement), and predicting the cp949 trap from the command text (both measured violations had ASCII commands and non-ASCII *data*).

**AU-23 Cost the hook before registering it.** A PowerShell hook process measured 600-700 ms per invocation here, which is unacceptable on every Write and every Bash call. Two levers exist in the hook contract: `if` narrows by permission-rule pattern so the process never spawns for non-matching calls, and `asyncRewake` runs the check in the background and wakes the model only when it exits non-zero, so a clean call costs nothing. Note `if` is **prefix** matching — see `work-rules-shell` SH-26 for the convention that keeps a git guard reachable.

## 7. New lessons

**AU-16** Add automation and Workflow lessons here with the measured date, and update the rule count in the header.

**AU-20** Before adding a trap here, check whether the tool description already documents it. A restated tool fact goes stale silently and then contradicts its source — measured 2026-07-29 in `agent-ops`, one day after that file was rewritten. Record only what the description does not say, or what was measured differently here, and point at the description for the rest (`agent-ops` AO-1).
