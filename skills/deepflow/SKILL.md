---
name: deepflow
description: Multi-lens advisory panel for reasoning/idea/decision questions where multiple angles actually change the conclusion — attach divergent-lens sonnet agents in parallel, collect independent opinions, and opus synthesizes & decides. Triggers "자문단", "여러 관점에서", "다각도로 봐줘", "패널 붙여줘", "council", "/deepflow"; opus may self-activate when a question needs multi-angle judgment even without an explicit request. Not for fact lookup, arithmetic, or single-answer questions. **deepflow-auto** mode (see §7) extends this into a critique→opus-synthesize→improve→re-critique convergence loop over any improvable artifact (documents·code·design); triggers "deepflow-auto", "검사 및 개선 사이클", "비판-개선 반복", "수렴까지 돌려".
---

# deepflow — multi-lens advisory panel

Rules: DF-1..DF-9 (9), tagged on the load-bearing points only; the §0-§7 stage headings carry the rest of the procedure. Section order is execution order, not importance.
Execution mechanics are canonical in `agent-ops`; delegation rules in CLAUDE.md G-20..G-24.

> **Terminology (user directive, 2026-06-10):** "opus" in this skill = **the model currently applied to the Claude Code session** (role name), not the fixed `claude-opus-*`. "sonnet" stays literal. Canonical definition: `agent-ops`.

## Purpose
For reasoning-heavy and judgment-heavy questions, instead of asking the same question N times, attach **different lenses** in parallel, collect independent opinions, and have opus synthesize all the way to a **decision**. Deliberately skewing each agent forces opus to confront framings it would otherwise anchor past. If every lens stays balanced, the N opinions converge on one framing and the panel has bought nothing.

> **DF-1 Lenses are the same model and are therefore not epistemically independent** — they share blind spots (`ai-characteristics` AI-4). The value is *forced framing separation*, not statistical diversity, so consensus is never read as truth (see §5 cross-check).

## §0 Activation
Only when **reasoning/judgment matters and multiple angles genuinely change the conclusion.**
- Explicit (`/deepflow`, "자문단", "다각도로") → activate. Implicit but fitting → **opus self-activates**: one line ("looks like a multi-angle call — running a panel; a few questions first") then go **straight to §1** (don't wait; §1 is itself the cost gate).
- **Skip** for fact lookup / arithmetic / search / single-answer technical decisions — answer directly and say "no panel needed."
- **Component mode (external call):** when a parent (e.g. buildflow) calls it with the **decision statement / criteria / constraints already supplied**, skip §0–§1 and **enter at §2** — the caller's gate (e.g. buildflow G1/G2) replaces them; the 6-field return feeds that gate.

## §1 Twenty-questions (opus direct)
**DF-2** Panel quality equals the quality of the decision statement, criteria and facts. Thin input makes the lenses fill the gaps with guesses and return something plausible but unfounded, so mine the user first.
- **Probe (priority order):** the real decision (behind the surface question) · criteria + weights · constraints · decisive facts · hidden prefs / deal-breakers · stakeholders · success/nightmare scenarios.
- **How:** AskUserQuestion, **batched** (2–4 at once), **adaptive** (follow up only on the uncertain), max 1–2 rounds. Stop the moment you can write a sharp decision statement + criteria + constraints.
- **Escape gate:** if the user says "just decide," fill gaps with **stated** assumptions and proceed.

Output = one-line **decision statement** + weighted criteria + key constraints/facts.

## §2 Lens composition (dynamic)
Don't pick from a fixed pool. **opus composes lenses fit to this task's domain** — angles that could actually change the conclusion. Pursue diversity *within this domain* (don't pad with unrelated-domain lenses for show).
- **Count:** as many as opus can still synthesize sharply — 3–5 to start, more if the domain is broad. sonnet is abundant; add when it helps quality.
- **Each lens = one sharp directive** (not persona roleplay). Inspiration only — optimist (upside, why it works) / premortem ("already failed", trace backward) / evidence·base-rate / first-principles / alternatives / long-term·2nd-order. **Not a fixed menu.** If the domain carries value/ethics/legal/emotional axes, compose those; for pure-technical work, don't.
- **Orthogonality & coverage check (sonnet, work tier):** hand the draft lens set to one sonnet agent — (㉠) are the lenses actually distinct angles (no dupes / same-axis poles)? (㉡) is a conclusion-changing axis missing? opus folds the feedback and finalizes.

## §3 Parallel lens agents (sonnet, lens tier)
One sonnet per lens, all independent. Raise reasoning by the means the substrate provides: inside a `Workflow`, the `effort` option on that `agent()` call; with the `Agent` tool, `ultrathink` in the prompt, which is the only lever there (`agent-ops` AO-15).
- **Output = the agent-ops Report envelope, lens-tier payload** — fixed 6 fields: `stance · reasons · killer_point · risks · flip_condition · confidence`. Each reason tagged `[fact-cited|inference|assumption|base-rate]`; preserve quotes/numbers/causal-chains verbatim (needed to judge flip_condition).
- Prompt essentials: "evaluate through [lens] only; don't retreat to neutral — your value is being sharp one way, balance is another lens's job; you can't see other panels; tag evidence vs guess." Fixed field order makes the panel comparable (stance-vs-stance, killer-vs-killer).

## §4 Round 2 (adaptive)
Run a cross-rebuttal round if ANY holds: the core split is a **fact dispute** (one side may be wrong) · the gap is **big enough to change the decision** · one agent landed a **killer the others must answer**. Skip if mostly-agreed, or the gap is taste/priority (preserve as a trade-off).
- Round 2 = sonnet + `ultrathink`; feed only a **digest** (each stance + killer_point), return `concessions / rebuttals / changed_mind / final_stance / confidence`.
- **loop-until-dry (optional thorough mode, = Workflow `loop-until-dry`):** repeat until **2 consecutive dry rounds** (0 new meaningful critiques); tell adversaries "only NEW weaknesses each round." Hard round cap (default 5) — if the cap hits while real issues still surface = non-convergence = escalate to user (no forced pass).
- **meaningful critique** = new + substantive + actionable + changes the conclusion. NOT = repeat/nitpick/style/out-of-scope/over-engineering.
- **Fact-dispute resolution:** confirm disputed facts with **tools** (WebSearch / measurement / code-run); if unconfirmable, mark "unconfirmed fact dispute" and **lower the confidence** of conclusions resting on it — never settle it by opus prior (that voids round 2).

## §5 Synthesis (opus direct)
```
consensus : most/all lenses agree = WEAK signal (may be same-model / shared-input) → cross-check vs evidence·base-rate to harden
conflict  : split points + [fact dispute vs value/priority dispute]
blind spot: what no one touched (opus meta-check + the §2 orthogonality sonnet catches it first)
```
**flip_condition check (before §6):** gather every lens's flip_condition, classify confirmed / unconfirmed / unconfirmable. For an **unconfirmed but decision-changing** one → confirm by tool, or lower the recommendation's confidence / escalate. (Don't collect-then-ignore.)

## §6 Decision (opus direct — recommendation + minority report)
Weight by criteria, converge to one recommendation. Format: **decision statement** · **recommendation** + one-line why · per-lens core (1–2 lines) · consensus ↔ conflict (fact vs value) · **minority report** (the dissenting lens's case, kept intact, not shaved) · flip condition + confidence (高/中/低).
- **DF-3 opus self-grading bias (AI-5):** when opus judges *its own* proposal through the panel (buildflow B-mode, for instance), it tends to downgrade valid critique to "meaningless" because it wants to converge. Base the proceed-or-stop call on **falsifiable dryness** (two consecutive rounds with zero new critiques), not on feel, and hold adversarial intensity to the end.
- **DF-4 Never flatten the user's explicit design intent (user directive, 2026-06-28).** When a panel optimizes against a constraint (narrow viewport, cost, perf) and its conclusion *replaces* something the user explicitly specified (their UI / flow / structure), do NOT synthesize toward the "optimized" version and argue the user into it. Surface the conflict as a **trade-off the user decides**, with their original intent presented as an **equal (not weaker) option** — the panel hardens the user's vision, it does not override it. Also: **don't invert a constraint the user stated on purpose.** (Observed: a designer panel replaced a user's Claude-style *floating* drawer with a fullscreen layout via "at 320px an overlay covers 80% anyway"; opus persuaded toward it, user approved, then reverted everything and said the panel "flattened" their plan. The user had made the drawer selection-only *because* the panel is narrow — meaning a small floating panel was the intent, not "fullscreen is inevitable.")

## Model split & execution
> Execution mechanics (Agent versus Workflow, model and effort per stage, the fire-signal-resume idle model, opt-in) are **canonical in `agent-ops`** — follow it. Below is only the deepflow-specific stage mapping.
- **sonnet:** orthogonality check (§2), lens opinions (§3), round 2 (§4). **opus:** activation (§0), twenty-questions (§1), lens compose and finalize (§2), synthesis (§5), decision (§6).
- **Stage to substrate:** §0-§1 and §5-§6 are load-bearing and run as opus direct. §3-§4 run as a **background `Workflow`** on the idle model: §3 is `parallel` with a `schema`, §4 is loop-until-dry, and opus reactivates per round on the completion signal. As a buildflow component this runs inside buildflow's script rather than nested.
- **Model and effort:** lens tier is explicit sonnet at the session's default effort (`agent-ops` AO-4). Lenses are a reasoning stage, so do not drop them to the cheap tier — the panel's output is the input to opus's decision.

## Checklist
| # | check |
|---|---|
| ① | activation fits (multi-angle changes the conclusion) |
| ② | twenty-questions → decision/criteria/constraints (or stated assumptions) |
| ③ | dynamic lens compose → sonnet orthogonality check → finalize |
| ④ | fan out (Agent single / Workflow loop; sonnet + ultrathink; Report envelope) |
| ⑤ | 6 envelope fields present |
| ⑥ | round-2 trigger? (run only if so) |
| ⑦ | synthesis (consensus = weak → cross-check) → flip-check → recommendation + minority + flip + confidence |

---

## §7 deepflow-auto — critique→improve convergence loop (extension mode)
Base deepflow stops at a **decision**. deepflow-auto keeps going: it loops **critique → opus-synthesize → improve(execute) → re-critique** until the *artifact itself* converges. Domain-agnostic — any improvable deliverable: documents (reports/specs/proposals), code, designs, plans. (Proven on a multi-cycle hwpx report overhaul: structure → style → content → form-compliance, each round a panel + a scoped rewrite.)

**Activation:** explicit ("deepflow-auto", "검사 및 개선 사이클", "비판-개선 반복", "수렴까지"). opus may **propose** it when the task is "iteratively refine an artifact to convergence" — but **auto-run is opt-in** (it spawns many agents across rounds; same gate as Workflow in agent-ops).

**Loop (round R):**
- **0. Extract target** — turn the artifact into critique-able text (doc → body extract with level/structure markers; code → diff/files). **Re-extract every round** — if the canonical was edited since last round (esp. *by the user*), that edit is the new base (canonical-check; never critique a stale copy).
- **1. Critique panel (§2–§3)** — domain-fit lenses in parallel (sonnet, `ultrathink`, Report envelope, lens-tier 6 fields). **Pass an "already-fixed — do not re-flag" context** so rounds don't relitigate resolved issues (dryness depends on this).
- **2. opus synthesis (§5) — load-bearing, never delegated.** opus judges each critique **against the source material** (paper / spec / requirements / user intent), not the critique text alone. Adopt/reject per source; consensus across lenses = weak signal (same-model). Decide the **scope** of this round's fix.
- **3. Improve (execute)** — hand the adopted directives to **section/chunk-level sonnet writers** (Workflow, `model:'sonnet'`, **write to file, return path + stats only** — agent-ops high-output rule; never re-emit the body). **Scope-limit to the named sections** — full rewrites churn and regress; touch only what this round adopted. Unchanged sections are copied forward, not regenerated.
- **4. Re-critique → loop-until-dry (§4)** — re-extract the improved artifact, back to step 1. **2 consecutive rounds with 0 *meaningful* critiques = converged → stop.** Round cap (default 5); cap hit with real issues still open = **escalate to user** (no forced pass). "meaningful" = new + substantive + actionable + conclusion-changing (§4).
- **5. Report each round** — for user-read artifacts, emit a short per-round change summary (what was adopted/rejected and why).

**Discipline:**
- **DF-5** **opus** does synthesis, adopt-or-reject against the source, scope decisions and the convergence call. **sonnet** runs critique lenses and executes improvements. opus stays the judge; sonnet does volume.
- **DF-6 Improve only the scoped sections.** The leading failure mode is a well-meant full rewrite that reintroduces problems already fixed. Scope every round narrowly.
- **DF-7 Re-extract the canonical each round.** The user may hand-edit between rounds, and silently overwriting their edit voids the whole point.
- **DF-8 A critique is a lead, not a verdict.** Confirm it against the source before adopting; a sharp-sounding lens can be wrong, and opus owns the call.
- **DF-9** Workflow background, opt-in, model per tier — all per `agent-ops`. For documents, pair with `new-hwpx-master` (styleIDRef level styles, no text delimiters).
