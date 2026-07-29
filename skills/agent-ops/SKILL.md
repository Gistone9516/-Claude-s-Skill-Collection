---
name: agent-ops
description: The canonical procedure for delegating to subagents - opus/sonnet division, model per tier, Workflow offload, the Report envelope, fan-out caps, and code-work division. Read right before spawning agents, fanning out, or writing a delegation prompt. Triggers include "delegate", "fan out", "spawn agents", "use subagents", 에이전트 분담, 팬아웃, 위임, and any moment opus is about to hand work to an agent.
---

# agent-ops — opus/sonnet delegation procedure

Rules: AO-1..AO-20 (20). CLAUDE.md G-20..G-24 are the always-on summary; this file is the procedure.

> **Terminology (user directive 2026-06-10).** "opus" throughout is a **role name** meaning the model currently applied to the Claude Code session — the main judge model. It is not the fixed `claude-opus-*`; when the user switches session model, every "opus" reference follows. The worker tier "sonnet" stays literal. Same convention in `buildflow` and `deepflow`.

> **Canonical home.** This skill is the single source of truth for delegation and execution mechanics: model-per-tier, Workflow offload and the fire-signal-resume model, the Report envelope, fan-out tiers and caps, code-work division. `buildflow` and `deepflow` reference these rather than restating them, and on any conflict this file wins. The execution substrate is the built-in `Workflow` tool, whose own description is canonical for tool semantics.

## 1. Core strategy

**AO-1 opus is the bottleneck, not the budget.** The goal is time and quality, not cost. sonnet is abundant, so heavy reading, exploration, first passes and surveys go to it and the raw text never enters opus's context. opus is the serial bottleneck and the highest-value judge; keep it for judgment, not fetching. sonnet still bills at sonnet rates, so fan out for coverage, time or quality — not by reflex.

**AO-2 Non-delegable, opus only:** deployment planning, load-bearing synthesis, ask-back and approval, risky-write decisions, prose composition, and any judgment that requires seeing. Everything that is "read and organize" goes to sonnet.

## 2. Reasoning-depth gate — the largest opus cost lever

**AO-3** opus cost is dominated by **output** (thinking plus visible text, roughly 5x input) plus the cached context re-read every turn, and a long opus turn inflates both. **Reasoning and output length, not subagent volume, is the bottleneck.** Scale thinking to stakes.

**AO-4** The gate is enforced by the report's **ROUTE token** (see the Report envelope): on a return, obey ROUTE and do not re-deliberate. Deciding "should I read deeper?" by reasoning *is* the cost — the agent pre-encodes that decision in ROUTE and opus follows it by reflex. The session effort setting is the hard ceiling; this gate is the per-turn throttle.

## 3. Workflow offload — the structural cost lever

**AO-5 Substantial or multi-agent work runs as a background `Workflow`, and opus stays idle until it completes** (user-mandated default whenever the user has opted into multi-agent work). Do not block opus with a foreground parallel `Agent` fan-out for multi-step, multi-agent or implementation work; that keeps opus active and burning context for the whole run, which the user has explicitly rejected. Foreground `Agent` is reserved for one or two genuinely one-shot lookups. Anything that fans out beyond two agents, loops, pipelines, or implements across folders goes to `Workflow`. This is a hard default, not advice.

**Idle, precisely:** fire → **the opus turn ends** → reactivate only on the completion signal → do the load-bearing part (synthesis, verification, commit) → fire the next → end again. Even a critique or lens panel goes into a background Workflow. deepflow and deepflow-auto are built on this: each round fires a critique Workflow, idles, synthesizes on the signal, fires an improve Workflow, idles, then verifies and commits. opus-in-the-loop and idle coexist because opus is active only at completion signals.

The reasoning-depth gate trims one turn; Workflow trims the whole run. Mechanizable work — loop-until-dry, fan-out over a work list, per-item verification, implementer worktrees — becomes ONE `Workflow` script that opus writes once and whose final structured result is all opus reads.

**AO-6 Set the model per tier. This is the biggest Workflow footgun.** `Workflow`'s `agent()` **defaults to the session model, which is opus** — unlike the `Agent` tool. Never rely on the default. Set `model` on every `agent()` by tier: **work, verify and lens all take `'sonnet'`** (no haiku). Load-bearing judgment is not an `agent()` at all — opus owns it outside the script; in-script `model:'opus'` only when it genuinely must live inside the loop, and then justify it. Omitting `model` silently runs the entire offload on opus.

- **Pipeline caveat.** `pipeline` stages auto-propagate without review, so a load-bearing middle stage is not sonnet-solo: pull it out to opus, or append a sonnet adversarial-verify stage. The script body is plain JS and is free; only `agent()` bills a model.

**AO-7 The tell-tale that Workflow was the right tool:** the same fan-out → judge → fan-out cycle repeated across N manual opus turns (an adversarial convergence loop; "spawn 10, read all, spawn verifiers"). N judge-turns over a growing transcript is the cost the user feels. One `loop-until-dry` or `pipeline` is one opus read.

**AO-8 Agent versus Workflow.** A couple of one-shot delegations → `Agent`, parallel in one message. Multi-stage, looping, or more than about six agents → `Workflow`. Once it loops or pipelines, default to Workflow.

**AO-9 Opt-in is mandatory.** `Workflow` runs only on user opt-in ("ultracode", an ultracode-on session, or an explicit "use a workflow / fan out / orchestrate"). Otherwise propose it with a rough cost and do not auto-launch.

**AO-10 Cron and ScheduleWakeup are not cost savings.** They re-invoke opus across context resets for *unattended* progress or to survive context limits, and each wake past the cache TTL is cache-cold and therefore pricier. Workflow offloads cost; Cron continues unattended at a knowingly higher per-turn cost.

## 4. Spawning an agent (the `Agent` tool)

**AO-11 Model is sonnet, no haiku.** Set `model:'sonnet'`. Only complex design, subtle judgment or final synthesis stays opus.

- **Raise reasoning through the prompt** — `think hard`, escalating to `ultrathink` for reasoning-heavy work. There is no effort parameter; the prompt is the lever.
- **Output style is caveman-ultra**, instructed in the prompt: enumeration and data ultra-compressed, while judgment, caveats and VERBATIM blocks are never compressed (Report envelope rule).
- **AO-12 Evidence-grounding is mandatory for factual, research and feasibility tasks.** Instruct the agent to web-search for grounds rather than lean on its embeddings. In the Report envelope, `[fact-cited]` means a real source — URL, file, or run output — never recall. Any factual, version, pricing, API or feasibility claim with no source is tagged `[assumption]` with lowered confidence and never dressed as fact. Skip search for pure logic or mechanical tasks. Embedding-only assertions are the primary hallucination vector.

### AO-13 High-output tasks — split, never single-shot (32k output cap)

A single agent's response is hard-capped at **32,000 output tokens**, and exceeding it makes the agent **fail with "response exceeded the 32000 output token maximum"**. Observed: an agent told to rewrite a whole 65k-character report died there, returning nothing after a full run. So for any task that emits a lot of text — writing, rewriting or translating long files, generating docs, full-content edits, large structured dumps — fan out to the maximum useful number of agents and never hand one agent the whole body.

- **Split by natural unit** (section, chapter, file, chunk) so each agent's *output* stays well under the cap — aim for 8-10k each.
- **Each agent writes its chunk directly to a file** with the Write tool and returns only the path and stats (ROUTE: relay). It must never re-emit the full body into its response, which is what blows the cap. The artifact lives on disk, not in the report.
- **opus reassembles from files** with a cheap concatenation, not by reading every chunk into context.
- **Estimate before delegating:** output characters ÷ 3 ≈ tokens. More than ~20k expected output means split. When unsure, over-split; extra agents are cheap and a failed full run wastes everything.
- Pairs with `Workflow`: a `pipeline` or `parallel` over the chunk list with a per-chunk `schema` returning `{path, stats}` is the clean encoding.

## 5. Report envelope — the sonnet-to-opus contract

**AO-14** A two-party contract: sonnet emits a structured report, and **opus obeys the read protocol by reflex and never reads everything.** The goal is maximum decision value and reliability for minimum opus reading.

**① Spawn contract (opus, at delegation time).** Tag the task once: **`sonnet-solo`** (user-read, reversible, does not auto-propagate without review) or **`load-bearing`**. This fixes the report shape and the default ROUTE, decided once while writing the delegation and never re-deliberated on return.

**② Send side (sonnet)**, layered for progressive disclosure:

- **L0 header, always:** `ROUTE: relay|judge|respawn|escalate`, `STATUS: done|partial|failed|refused`, one-line `TLDR`.
- **L1 reliability, always:** `coverage: census|sample(N/M)`, `confidence: H/M/L + basis` (calibrated, never bare), `not_seen`, `truncated_due_to: none|context|time|cap`, `assumptions`, `self_falsify` (what would flip this, and the weakest point).
- **L2 payload**, below a `─── opus: stop here if ROUTE=relay ───` delimiter: tier-specific, each claim tagged `[fact-cited|inference|assumption|base-rate]`, and a **VERBATIM block** (strings, numbers, IDs, paths, quotes, causal chains) that is never compressed.
- **`signal`, always, compression-resistant:** anything important that did not fit the fields, raw; "none" if truly nothing. This is the overflow channel against force-fitting and omission.
- **L3 for_opus, load-bearing only:** `decide` (what opus must judge), `pointers`, `open_questions`.

**③ Receive side (opus).** Read L0's ROUTE and act by reflex without re-reasoning: `relay` → emit "done + location + L1 flags" in one or two lines and stop, without reading L2; `judge` → read the payload and reason; `respawn` → re-spawn (failed or partial); `escalate` → sonnet found something stake-changing, so read it and raise it to the user.

**AO-15 Two symmetric failure modes to guard.**

- **Over-compression on the send side:** sonnet's real finding never reaches opus. Defenses — the `signal` channel; **the discoverer upgrades richness** (sonnet may set ROUTE=judge or escalate and carry the full finding even when spawned `sonnet-solo`, because what reaches opus is decided by the sonnet that found it); judgment and caveats are never caveman'd, only enumeration and data are; and the self-check "can opus act without re-reading what I read?"
- **Over-reading on the receive side:** opus reads everything every time and the contract is void. Defenses — ROUTE is a command, not a hint; the delimiter makes the lazy path the correct path; `sonnet-solo` returns a minimal shape so there is no payload to deliberate about.

**Tier payloads (L2):**

- **work** (scout, gather): enumerated `items` with a declared count N, `file:line` pointers, a structure map, and `count_check: N==N`.
- **verify** (machine check): `pass` as a count only, and `fail` with each item verbatim — source, location, reason.
- **lens** (opinion or council, e.g. deepflow): fixed order `stance · reasons · killer_point · risks · flip_condition · confidence`, which is what makes stance-versus-stance comparison across the panel possible.

Force a `schema` wherever the runtime allows (Workflow `schema`, and equivalents) so missing fields surface.

## 6. Fan-out

**AO-16 Fan-out needs prior approval (user directive 2026-07-20).** Before starting any fan-out, `Workflow` included, report the expected total agent count with a per-stage breakdown and get the user's approval. For prebuilt workflows such as deep-research, estimate the multiplying stages (per-claim verification votes and the like) and present the total first — measured: deep-research expanded to 66 agents through three votes per claim, and the user judged it excessive. Exceptions: one or two one-shot lookups (report only), and the `verify-fanout` brief agent, which is a standing exception and is not counted. Resuming an approved plan needs no re-approval; expecting to exceed the approved count does.

**AO-17 The sequence** is ① deployment plan (how many, each one's scope) → ② parallel activation → ③ opus synthesis, only when load-bearing. Otherwise ROUTE handles it and review-optional results go straight to the user.

**AO-18 Three tiers and their caps** (empirical starting points, not hard ceilings): work (explore, gather) about 10, verify (machine check) about 2, lens (opinion — deepflow lenses, buildflow adversarial) separate. The cap is the maximum that does not degrade opus's ability to synthesize sharply; sonnet is abundant, so raise it where it helps quality. The verify cap of 2 applies to machine verification only.

**AO-19 Parallel is read and explore only; writes are serial**, because concurrent edits corrupt files. The parallel-write pattern is one agent per folder with `isolation:'worktree'`, while shared files (types, config) and the final merge stay with opus.

**Parallel needs true independence, even across worktrees.** A producer-to-consumer dependency, where one agent's output is another's input, is not parallel: pipeline the stages or pre-stage the shared input. Run co-parallel, the consumer fabricates a stand-in for the missing input — observed in a buildflow build stage. Map producer-consumer dependencies before fanning out.

**Plan and fan out only when parallelism pays.** Single lookups and trivial commands are opus direct.

## 7. Division by task type

sonnet gathers, locates, executes and mechanically verifies; opus judges, composes, decides and sees. The dividing line: is this verbatim-plus-judgment, or just fetching?

| Task | sonnet (delegate) | opus (direct) |
|---|---|---|
| Human-read writing (자소서, 회의록, papers, reports) | gather, extract source verbatim, lay out | composition (remove AI tells, 음슴체 voice) |
| Document-file editing (hwpx, pptx, docx) | run scripts, run the Rule 4 validation, report | the final "OK to deliver?" call |
| Research and information gathering | search, fetch, extract | synthesis and adversarial verification, only if load-bearing |
| Design (slides, figures, Figma) | scan, export, render | judging the render aesthetically (subtract, stay calm) |
| Diagnosis and debugging | locate symptoms, collect logs | root cause and the fix decision |
| File cleanup and survey | exhaustive mapping, content diff | the cleanup plan and the delete decision |

- **Verbatim-body trap:** when user text must not change by one character (자소서, 회의록), opus places the verbatim source itself and sonnet only gathers.
- **Seeing required:** design aesthetics, render checks and figure integrity need the image in opus's own context. opus looks directly and never trusts a sonnet "looks fine".

## 8. Code-work division

**AO-20** Precise edits cannot run off summaries — opus must see the code verbatim. But opus needs the surgical site, not the whole repo.

1. **sonnet scouts** — which file and function, all call sites, dependencies and data flow. Returns `file:line` pointers and a structure map. No summarizing of code: verbatim snippets or pointers, nothing in between.
2. **opus edits precisely** — Read only the pointed-to files, then design, logic edits and review.
3. **sonnet verifies** — run tests, lint and build, reporting failures verbatim; also repetitive mechanical edits such as renames and signature propagation.

- **Implementer completeness.** An agent that *writes* code reads its whole assignment — spec or contract plus the existing files it will touch — with zero omission and reports coverage before editing. Skim-then-write produces drift.
- **opus owns integration and contracts.** Cross-chunk interfaces, integration and merges are never delegated. **Author the shared-interface SoT first** (shared types, field names, enums, error codes, serialization, wiring) before any parallel per-chunk drafting; independent drafts reconciled afterwards cost N rounds of churn.
- **Reuse structure maps** by saving them as `.md` for the next session, but per CLAUDE.md G-08, Read the target file again immediately before editing.
