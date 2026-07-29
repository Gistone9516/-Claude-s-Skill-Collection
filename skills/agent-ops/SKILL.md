---
name: agent-ops
description: Delegation policy - the opus/sonnet division, model and effort per stage, when to use Agent versus Workflow, fan-out approval and caps, the Report envelope, and how large or unattended runs are structured. Holds policy and rationale only; the tool descriptions are canonical for mechanics. Read right before spawning agents, fanning out, or writing a delegation prompt. Triggers include "delegate", "fan out", "spawn agents", "use subagents", 에이전트 분담, 팬아웃, 위임.
---

# agent-ops — delegation policy

Rules: AO-1..AO-23 (23). CLAUDE.md G-20..G-24 is the always-on summary. Rationale for the rules here lives in `ai-characteristics`.

> **Terminology (user directive 2026-06-10).** "opus" is a **role name** meaning the model currently applied to this session — the main judge model. It is not the fixed `claude-opus-*`; when the session model changes, every "opus" reference follows. "sonnet" stays literal.

## 1. What is canonical where

**AO-1 The tool descriptions are canonical for mechanics; this file is canonical for policy.**

| Question | Answer lives in |
|---|---|
| What does `agent()` accept, what is the concurrency cap, what throws | the `Workflow` tool description |
| Does the `Agent` tool run in background, what does `isolation` do | the `Agent` tool description |
| How long may a wakeup delay be, is the context still cached | the `ScheduleWakeup` description |
| **Which model and effort should this stage get** | here |
| **Whether to fan out at all, and with whose permission** | here |
| **What a subagent must return and how opus reads it** | here |

Do not restate a tool fact in this file. Tool contracts change faster than skills do, and a restated fact silently becomes a lie — measured on 2026-07-29, when this file carried two contradicted claims and five missing capabilities one day after being rewritten. When a rule depends on a tool fact, name the fact and point at its source rather than copying it.

`buildflow` and `deepflow` reference this file rather than restating it; on conflict, this file wins.

## 2. The division

**AO-2 opus is the bottleneck and the highest-value judge, not the budget constraint.** The goal is time and quality. sonnet is abundant, so heavy reading, exploration, first passes and surveys go to it and the raw text never enters opus's context.

**Non-delegable, opus only:** deployment planning, load-bearing synthesis, ask-back and approval, risky-write decisions, prose composition, and any judgement that requires seeing. Everything that is "read and organize" goes to sonnet.

**AO-3 Match reasoning depth to stakes.** opus cost is dominated by output — thinking plus visible text — plus the cached context re-read every turn, so **output length, not agent count, is the bottleneck.** On a return, obey the report's ROUTE token by reflex and do not re-deliberate: deciding "should I read deeper?" by reasoning *is* the cost, and the agent pre-encodes that decision.

## 3. Model and effort per stage (user directive 2026-07-29)

**AO-4 Split the decision by what the stage does, not by a blanket default.**

| Stage | model | effort | Why |
|---|---|---|---|
| Mechanical and bulk — scout, gather, locate, enumerate, mechanical verification, repetitive edits | `'sonnet'`, explicit | `'low'` | Volume work with a checkable answer. The cheapest tier that can do it is the right tier. |
| Lens and critique | `'sonnet'`, explicit | session default | Needs reasoning but not the judge model; the panel's value is framing separation, not raw capability (AI-4). |
| Judgement-adjacent inside a loop — adversarial verify, adopt/reject screening | omit `model` | omit or raise | Inherits the session model. Getting this wrong is more expensive than the model difference. |
| Load-bearing judgement | **not an `agent()` at all** | — | AO-5. |

This is deliberately not the tool's default. The `Workflow` description recommends omitting `model` because inheriting the session model is usually correct for quality; that guidance is right for correctness and wrong for a fan-out of twenty scouts. **The rule: name the tier when the stage is mechanical, inherit when the stage judges.** When genuinely unsure which it is, inherit — a wrong cheap answer costs more than the saving.

**AO-5 Load-bearing judgement is never an `agent()`.** opus owns it outside the script. In-script escalation only when the judgement must live inside the loop, and then say why in a comment. A `pipeline` stage auto-propagates without review, so a judging middle stage is not safe as a cheap tier — pull it out to opus, or follow it with an adversarial verify stage.

## 4. Substrate: Agent or Workflow

**AO-6 Choose by structure, not by blocking behaviour.** The `Agent` tool now runs in the background by default and notifies on completion, so "Agent blocks opus" is no longer the reason to prefer `Workflow`. The reason that remains, and is stronger:

- **`Workflow`** when the work has *structure opus should not have to hold*: loops, pipelines, fan-out over a work list, per-item verification, convergence to a condition, more than a few agents. The script encodes the control flow deterministically, opus writes it once and reads one structured result.
- **`Agent`** when the work is one or two independent lookups with no downstream structure. Multiple independent agents go in a single message so they run concurrently.

**AO-7 The idle model.** Fire → **the opus turn ends** → reactivate on the completion signal → do the load-bearing part → fire the next → end again. opus is active only at signals. deepflow and buildflow are built on this, which is why opus-in-the-loop and idle coexist.

**AO-8 Multi-agent work is opt-in.** Run a `Workflow` only on explicit opt-in. Otherwise propose it with a rough cost and do not launch.

**AO-9 Unattended continuation is a different tool from cost offload.** `Workflow` offloads work; `ScheduleWakeup` and `CronCreate` re-invoke opus so a run continues while the user is away. Pick the wakeup delay from what is actually being waited on — an external CI run, a deploy, a queue — not from cache behaviour. Never schedule a wakeup to keep a cache warm. When harness-tracked work will notify on completion, a wakeup is only a long fallback in case it never does.

**AO-10 Continue an existing agent instead of respawning when its context is the point.** `SendMessage` resumes a previously spawned agent with its context intact; a fresh `Agent` call starts from nothing. Re-sending a large brief to a new agent to ask one follow-up is waste.

**AO-11 A finished Workflow's journal is the ground truth for what it returned.** Before diagnosing an empty or surprising result, read the run's journal rather than assuming a cached result was non-empty. To iterate on a script, edit the persisted script file and re-invoke against it; to continue after an edit, resume from the prior run id so the unchanged prefix is not re-run.

## 5. Fan-out

**AO-12 Fan-out needs prior approval (user directive 2026-07-20).** Before starting any fan-out, `Workflow` included, report the expected total agent count with a per-stage breakdown and get approval. For a prebuilt workflow, estimate its multiplying stages and present the total first — measured: deep-research expanded to 66 agents through three verification votes per claim, which the user judged excessive.

Exceptions: one or two one-shot lookups, and the `verify-fanout` brief agent, which is a standing exception and is never counted. Resuming inside an approved budget needs no re-approval; expecting to exceed it does.

**AO-13 Caps are a synthesis limit, not a technical one.** The runtime's own concurrency and total limits are in the tool description and are far above anything used here; the session may also carry a workflow-size guideline. The binding constraint is different: **the most agents whose output opus can still synthesize sharply.** Empirical starting points are about 10 for work (explore, gather) and about 2 for machine verification, with lens as its own tier. Raise them where it demonstrably helps quality.

**AO-14 Writes are serial; parallel is for reading.** The parallel-write pattern is one agent per folder in its own worktree, with shared files and the final merge staying with opus.

**Parallel needs true independence, even across worktrees.** A producer-to-consumer dependency is not parallel — pipeline the stages or pre-stage the shared input, because a consumer run without its input will invent one (AI-6). Map those dependencies before fanning out.

## 6. What a delegated agent is told

**AO-15 Defaults for a spawned agent:** sonnet for mechanical work per AO-4; output style caveman-ultra for enumeration and data, with judgement, caveats and verbatim blocks never compressed; and the Report envelope as the return shape.

Raise reasoning by the means the substrate provides — inside a `Workflow`, the `effort` option on that call; with the `Agent` tool, the prompt (`think hard`, `ultrathink`), which is the only lever there.

**AO-16 Evidence-grounding is mandatory for factual, research and feasibility tasks.** Instruct the agent to search for grounds rather than lean on recall. `[fact-cited]` means a real source — URL, file, or run output. Any factual, version, pricing, API or feasibility claim without one is tagged `[assumption]` with lowered confidence and never dressed as fact (AI-2). Skip search for pure logic and mechanical tasks.

**AO-17 High-output tasks are split, never single-shot.** An agent that exceeds its response cap fails and returns nothing after doing all the work (AI-12). For anything that emits a lot of text — long rewrites, translations, generated docs, large structured dumps:

- Split by natural unit so each agent's *output* stays well under the cap.
- **Each agent writes its chunk directly to a file and returns only the path and stats** (ROUTE: relay). It must never re-emit the body into its response.
- opus reassembles from files with a cheap concatenation, not by reading every chunk.
- Estimate first: output characters ÷ 3 ≈ tokens. When unsure, over-split — extra agents are cheap, a failed full run is not.

## 7. Report envelope — the subagent-to-opus contract

**AO-18** sonnet emits a structured report; **opus obeys the read protocol by reflex and never reads everything.**

**① At delegation time** tag the task once: **`sonnet-solo`** (user-read, reversible, does not auto-propagate) or **`load-bearing`**. This fixes the report shape and the default ROUTE, decided once while writing the delegation.

**② Send side**, layered:

- **L0, always:** `ROUTE: relay|judge|respawn|escalate`, `STATUS: done|partial|failed|refused`, one-line `TLDR`.
- **L1 reliability, always:** `coverage: census|sample(N/M)`, `confidence: H/M/L + basis`, `not_seen`, `truncated_due_to`, `assumptions`, `self_falsify`.
- **L2 payload**, below a `─── opus: stop here if ROUTE=relay ───` delimiter: each claim tagged `[fact-cited|inference|assumption|base-rate]`, plus a **VERBATIM block** (strings, numbers, IDs, paths, quotes, causal chains) that is never compressed.
- **`signal`, always:** anything important that did not fit the fields, raw; "none" if truly nothing. The compression-resistant overflow channel (AI-10).
- **L3 for_opus, load-bearing only:** `decide`, `pointers`, `open_questions`.

**③ Receive side.** Read ROUTE and act without re-reasoning: `relay` → one or two lines and stop, do not read L2; `judge` → read the payload; `respawn` → re-spawn; `escalate` → read it and raise it to the user.

**AO-19 Guard both failure directions.**

- **Over-compression (send).** Defenses: the `signal` channel; **the discoverer upgrades richness** — a subagent may set ROUTE=judge or escalate and carry the full finding even when spawned `sonnet-solo`, because what reaches opus is decided by whoever found it; and judgement and caveats are never compressed, only enumeration and data.
- **Over-reading (receive).** Defenses: ROUTE is a command, not a hint; the delimiter makes the lazy path the correct path; `sonnet-solo` returns a minimal shape so there is nothing to deliberate about.

**Tier payloads:** **work** — enumerated `items` with a declared count, `file:line` pointers, structure map, `count_check`. **verify** — `pass` as a count, `fail` verbatim with source, location and reason. **lens** — fixed order `stance · reasons · killer_point · risks · flip_condition · confidence`, which is what makes stance-versus-stance comparison possible.

Force a structured `schema` wherever the runtime allows it, so missing fields surface instead of being narrated around.

## 8. Division by task type

sonnet gathers, locates, executes and mechanically verifies; opus judges, composes, decides and sees. The dividing line: verbatim-plus-judgement, or just fetching?

| Task | sonnet | opus |
|---|---|---|
| Human-read writing (자소서, 회의록, papers, reports) | gather, extract source verbatim, lay out | composition (remove AI tells, 음슴체 voice) |
| Document-file editing (hwpx, pptx, docx) | run scripts, run the validation, report | the final "OK to deliver?" call |
| Research and information gathering | search, fetch, extract | synthesis and adversarial verification, if load-bearing |
| Design (slides, figures, Figma) | scan, export, render | judging the render (subtract, stay calm) |
| Diagnosis and debugging | locate symptoms, collect logs | root cause and the fix decision |
| File cleanup and survey | exhaustive mapping, content diff | the cleanup plan and the delete decision |

- **Verbatim-body trap:** when user text must not change by one character, opus places the verbatim source itself and sonnet only gathers.
- **Seeing required:** design aesthetics, render checks and figure integrity need the image in opus's own context. opus looks directly and never trusts a "looks fine".

## 9. Code work

**AO-20 Scout, edit, verify.** Precise edits cannot run off summaries — opus must see the code verbatim — but opus needs the surgical site, not the repo.

1. **sonnet scouts** — which file and function, all call sites, dependencies and data flow. Returns `file:line` pointers and a structure map. No summarizing of code: verbatim snippets or pointers, nothing between.
2. **opus edits** — Read only the pointed-to files, then design, logic edits and review.
3. **sonnet verifies** — tests, lint, build, failures reported verbatim; also mechanical repetition such as renames and signature propagation.

**AO-21 An agent that writes code reads its whole assignment first** — spec or contract plus every existing file it will touch, with zero omission — and reports coverage before editing. Skim-then-write produces drift (AI-3).

**AO-22 opus owns integration and contracts.** Cross-chunk interfaces, integration and merges are never delegated. **Author the shared-interface SoT first** — shared types, field names, enums, error codes, serialization, wiring — before any parallel per-chunk drafting. Independent drafts reconciled afterwards cost N rounds of churn; measured at 7 rounds on a 6-contract spec.

## 10. Large and unattended runs

**AO-23 As scope grows, the partition becomes the deliverable.** At small scale a bad split costs a merge; at large scale it costs the run. Before fanning out over a big surface:

- **Partition so each unit is independently checkable**, and write the check with the partition. A unit whose result cannot be verified without reading the others was not partitioned.
- **Name the shared surface explicitly** and freeze it first (AO-22). Everything not in it is local to a unit.
- **Declare coverage as data, not prose** — the work list is enumerable, each item's result is one row, and the count is compared. "All done" is a claim (AI-8); a row count is a fact.
- **Verify by execution wherever execution is possible.** Agents generate; deterministic runs prove.

For an unattended run, add: a periodic health check rather than waiting only for a completion signal, resumption from the run id rather than restarting, and **park-and-continue** — when a decision genuinely needs the user, append it to a decisions log, skip only that sub-part, continue the rest of the same task, and present every parked decision in one briefing at the end. A hard-floor failure (test or integration failure, corruption) still halts, because parking applies to decisions and not to a broken state. Details in `work-rules-automation` and `buildflow`.
