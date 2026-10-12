---
name: agent-ops
description: Delegation policy - the opus/sonnet division, model and effort per stage, when to use Agent versus Workflow, fan-out approval and caps, the Report envelope, and how large or unattended runs are structured. Holds policy and rationale only; the tool descriptions are canonical for mechanics. Read right before spawning agents, fanning out, or writing a delegation prompt. Triggers include "delegate", "fan out", "spawn agents", "use subagents", 에이전트 분담, 팬아웃, 위임.
---

# agent-ops — delegation policy

Rules: AO-1..AO-24 (24). CLAUDE.md §1 routes here and §4 points here; the fan-out approval gate itself is CLAUDE.md G-22. Rationale lives in `ai-characteristics`. "opus" is a role name for the session's model (CLAUDE.md G-03); "sonnet" is literal.

## 1. What is canonical where

**AO-1 The tool descriptions are canonical for mechanics; this file is canonical for policy.**

| Question | Answer lives in |
|---|---|
| What does `agent()` accept, what is the concurrency cap, what throws | the `Workflow` tool description |
| Does the `Agent` tool run in background, what does `isolation` do | the `Agent` tool description |
| How long may a wakeup delay be, is the context still cached | the `ScheduleWakeup` description |
| **Which model and effort should this stage get** | here |
| **Whether to fan out at all, and with whose permission** | here and G-22 |
| **What a subagent must return and how opus reads it** | here |

Do not restate a tool fact here; tool contracts change faster than skills, and a copied fact silently becomes a lie (measured 2026-07-29: two contradicted claims a day after a rewrite). Name the fact and point at its source.

`buildflow` and `deepflow` reference this file rather than restating it; on conflict, this file wins.

## 2. The division

**AO-2 opus is the bottleneck and the highest-value judge, not the budget constraint.** sonnet takes heavy reading, exploration, first passes and surveys, so raw text never enters opus's context. **Non-delegable, opus only:** deployment planning, load-bearing synthesis, ask-back and approval, risky-write decisions, prose composition, and any judgement that requires seeing.

**AO-3 Match reasoning depth to stakes.** opus cost is dominated by its own output plus the cached context re-read every turn, so **output length, not agent count, is the bottleneck.** On a return, obey the report's ROUTE by reflex; deciding "should I read deeper?" by reasoning *is* the cost.

## 3. Model and effort per stage (user directive 2026-07-29)

**AO-4 Split the decision by what the stage does, not by a blanket default.**

| Stage | model | effort | Why |
|---|---|---|---|
| Mechanical and bulk: scout, gather, locate, enumerate, mechanical verification, repetitive edits | `'sonnet'`, explicit | `'low'` | Volume work with a checkable answer |
| Lens and critique | `'sonnet'`, explicit | session default | The panel's value is framing separation, not raw capability (AI-4) |
| Judgement-adjacent inside a loop: adversarial verify, adopt/reject screening | omit `model` | omit or raise | A wrong cheap answer here costs more than the model difference |
| Load-bearing judgement | **not an `agent()` at all** | — | AO-5 |

The `Workflow` description recommends omitting `model`; that is right for correctness and wrong for twenty scouts. **Name the tier when the stage is mechanical, inherit when it judges**, and inherit when unsure.

**AO-5 Load-bearing judgement is never an `agent()`.** opus owns it outside the script. In-script escalation only when the judgement must live inside the loop, with a comment saying why. A `pipeline` stage auto-propagates without review, so a judging middle stage is pulled out to opus or followed by an adversarial verify stage.

## 4. Substrate: Agent or Workflow

**AO-6 Choose by structure.**
- **`Workflow`** when the work has structure opus should not hold: loops, pipelines, fan-out over a work list, per-item verification, convergence, more than a few agents. opus writes the control flow once and reads one structured result.
- **`Agent`** for one or two independent lookups with no downstream structure; several go in a single message so they run concurrently.

**AO-7 The idle model.** Fire, end the opus turn, reactivate on the completion signal, do the load-bearing part, fire the next. deepflow and buildflow are built on this.

**AO-8 A `Workflow` runs only on the user's explicit opt-in**; otherwise propose it with a rough cost. The approval gate is G-22.

**AO-9 Unattended continuation is a different tool from cost offload.** `Workflow` offloads work; `ScheduleWakeup` and `CronCreate` re-invoke opus while the user is away.

**AO-10 Continue an existing agent instead of respawning when its context is the point** (`SendMessage`). Re-sending a large brief to a new agent for one follow-up is waste.

**AO-11 A finished Workflow's journal is the ground truth for what it returned.** Read it before diagnosing an empty or surprising result.

## 5. Fan-out

**AO-12 Report the count with its breakdown before fanning out (G-22).** For a prebuilt workflow, estimate its multiplying stages first; measured, deep-research expanded to 66 agents through per-claim votes. Pre-approved but still counted in the reported total: one or two one-shot lookups, the `verify-fanout` brief pair (both agents), and the AO-24 design pair. Measured 2026-09-07: the standing pairs were 45% of all agents spawned and invisible to the gate, so exemption from permission is not exemption from arithmetic. Resuming inside an approved budget needs no re-approval; exceeding it does.

**AO-13 Two caps bind: synthesis, and cost.** What binds is the most agents whose output opus can still synthesize sharply, and the price. Measured 2026-09-07 over 83 agents: floor about 90k billable tokens, median about 320k, and the agent type did not change it. Read every count as its price and say it when raising one.

**The cost is reading, not writing:** output was 4% of billable tokens. Telling an agent to be brief saves little; naming the files it may open and forbidding it to survey past them saves most.

**AO-14 Writes are serial; parallel is for reading.** Parallel writing is one agent per folder in its own worktree, with shared files and the final merge staying with opus. **Parallel needs true independence:** a producer-to-consumer dependency is a pipeline, because a consumer run without its input invents one (AI-6).

## 6. What a delegated agent is told

**AO-15 Defaults for a spawned agent:** sonnet for mechanical work (AO-4); compressed output (caveman-ultra) for enumeration and data, with judgement, caveats and verbatim blocks never compressed; the Report envelope as the return shape.

- **Effort floors low (user directive 2026-09-07: "어차피 정확한 내용을 원하는게 아니니까").** In a `Workflow`, pass `effort: 'low'` and raise it only for a stage that judges. Where there is no effort parameter, the prompt is the lever: omit `think hard` / `ultrathink` by default. Raising is a stated decision, not a default; `deepflow` and `buildflow` follow this.
- **Fix the return size at delegation time (user directive 2026-09-07).** Every agent bills twice, once to run and once for opus to read. A standing pair returns 3-5 decision lines (`verify-fanout` VF-10). Measured 2026-08-22: brief-pair forensics flowed into a student's internship diary and had to be rewritten.

**AO-16 Evidence-grounding is mandatory for factual, research and feasibility tasks.** `[fact-cited]` means a real source: URL, file or run output. A claim without one is `[assumption]` with lowered confidence (AI-2). Skip search for pure logic and mechanical tasks.

**AO-17 High-output tasks are split, never single-shot.** An agent past its response cap returns nothing after doing all the work (AI-12). Split by natural unit; **each agent writes its chunk to a file and returns only the path and stats** (ROUTE: relay); opus reassembles by concatenation. Output characters ÷ 3 ≈ tokens; when unsure, over-split.

## 7. Report envelope — the subagent-to-opus contract

**AO-18** sonnet emits a structured report; **opus obeys the read protocol by reflex and never reads everything.**

**① At delegation time** tag the task once: **`sonnet-solo`** (user-read, reversible, does not auto-propagate) or **`load-bearing`**. This fixes the report shape and the default ROUTE.

**② Send side**, layered:

- **L0, always:** `ROUTE: relay|judge|respawn|escalate`, `STATUS: done|partial|failed|refused`, one-line `TLDR`.
- **L1 reliability, always:** `coverage: census|sample(N/M)`, `confidence: H/M/L + basis`, `not_seen`, `truncated_due_to`, `assumptions`, `self_falsify`.
- **L2 payload**, below a `─── opus: stop here if ROUTE=relay ───` delimiter: each claim tagged `[fact-cited|inference|assumption|base-rate]`, plus a **VERBATIM block** (strings, numbers, IDs, paths, quotes, causal chains) that is never compressed.
- **`signal`, always:** anything important that did not fit the fields, raw; "none" if truly nothing (AI-10).
- **L3 for_opus, load-bearing only:** `decide`, `pointers`, `open_questions`.

**③ Receive side.** Act on ROUTE without re-reasoning: `relay` one or two lines and stop; `judge` read the payload; `respawn` re-spawn; `escalate` read it and raise it to the user.

**AO-19 Guard both failure directions.**

- **Over-compression (send).** The `signal` channel; **the discoverer upgrades richness**, so a subagent spawned `sonnet-solo` may set ROUTE=judge or escalate and carry the full finding; judgement and caveats are never compressed.
- **Over-reading (receive).** ROUTE is a command; the delimiter makes the lazy path the correct one; `sonnet-solo` returns a minimal shape.

**Tier payloads:** **work** — enumerated `items` with a declared count, `file:line` pointers, structure map, `count_check`. **verify** — `pass` as a count, `fail` verbatim with source, location and reason. **lens** — fixed order `stance · reasons · killer_point · risks · flip_condition · confidence`.

Force a structured `schema` wherever the runtime allows it, so missing fields surface instead of being narrated around.

## 8. Division by task type

sonnet gathers, locates, executes and mechanically verifies; opus judges, composes, decides and sees.

| Task | sonnet | opus |
|---|---|---|
| Human-read writing (자소서, 회의록, papers, reports) | gather, extract source verbatim, lay out | composition, from the user's exemplars (`work-rules-writing` WR-2) |
| Document-file editing (hwpx, pptx, docx) | run scripts, run the validation, report | the final "OK to deliver?" call |
| Research and information gathering | search, fetch, extract | synthesis and adversarial verification, if load-bearing |
| Design (slides, figures, Figma) | scan, export, render | judging the render |
| Diagnosis and debugging | locate symptoms, collect logs | root cause and the fix decision |
| File cleanup and survey | exhaustive mapping, content diff | the cleanup plan and the delete decision |

- **Verbatim-body trap:** when user text must not change by one character, opus places the verbatim source itself.
- **Seeing required:** render checks and figure integrity need the image in opus's own context; never trust a "looks fine".

## 9. Code work

**AO-20 Scout, edit, verify.** opus must see the code verbatim, but needs the surgical site, not the repo.

1. **sonnet scouts**: which file and function, all call sites, dependencies and data flow, as `file:line` pointers and a structure map. Verbatim snippets or pointers, no summaries of code.
2. **opus edits**: reads only the pointed-to files, then designs, edits and reviews.
3. **sonnet verifies**: tests, lint, build, failures verbatim; also mechanical repetition such as renames.

**AO-21 An agent that writes code reads its whole assignment first** (spec or contract plus every existing file it will touch) and reports coverage before editing (AI-3).

**AO-22 opus owns integration and contracts.** Cross-chunk interfaces, integration and merges are never delegated. **Author the shared-interface SoT first** (shared types, field names, enums, error codes, serialization, wiring) before parallel per-chunk drafting; reconciling independent drafts afterwards took 7 rounds on a 6-contract spec.

**AO-24 UI work carries a design pair, one agent per scope (user directive 2026-09-02).** When a UI is written or changed, attach two `frontend-design` agents before the edit, split by scope as the brief pair splits by lens (AI-4).

| Scope | Its question | What it catches |
|---|---|---|
| **대상 (target)** | What should this element be, given its own constraints? | The control itself: form, placement, states, the exact CSS and copy |
| **주변 (surroundings)** | Will it be continuous with what is already here, and can it be built? | A second word for a job the product already names; a label meaning something else nearby; layout consequences; blast radius |

- Both are proposals, never edits; adopting is opus's call against the source (AO-5). Feed the target agent any measurement it would otherwise guess.
- Call it once there is a concrete change to review; give each scope its half and say the other is covered (VF-21); let either answer "주의할 것 없음" (VF-9). Measured on the first run: each scope found something the other could not.
- Pre-approved and counted (AO-12); skipped when the change has no UI.
- **On UI work the standing agents are three, not four (2026-09-07).** G-10's 주변 lens and this pair's 주변 ask one question, so run 현장, 대상 and 주변, and say the fourth was merged.

## 10. Large and unattended runs

**AO-23 As scope grows, the partition becomes the deliverable.** Before fanning out over a big surface:

- **Partition so each unit is independently checkable**, and write the check with the partition.
- **Name the shared surface explicitly** and freeze it first (AO-22).
- **Declare coverage as data, not prose**: an enumerable work list, one row per result, a compared count (AI-8).
- **Verify by execution wherever possible.** Agents generate; deterministic runs prove.

For an unattended run, add a periodic health check, resumption from the run id rather than restarting, and **park-and-continue**: a decision that genuinely needs the user goes to a decisions log, only that sub-part is skipped, the rest of the same task continues, and every parked decision is presented in one briefing at the end. A hard-floor failure (test or integration failure, corruption) still halts; parking is for decisions, not for a broken state. `buildflow` BF-6 applies this to full-delegation runs.
