---
name: agent-ops
description: This skill should be used before spawning or delegating to subagents — when fanning out parallel agents, deciding the opus-vs-sonnet division of labor, or writing a delegation prompt. It holds the full procedure that the lean CLAUDE.md "Agent ops" rule points to. Triggers include "delegate", "fan out", "spawn agents", "use subagents", "에이전트 분담", "팬아웃", "위임", and any moment opus is about to hand work to an agent.
---

# Agent ops — opus/sonnet delegation procedure

> **Terminology (user directive, 2026-06-10):** "opus" throughout this skill is a **role name = "the model currently applied to the Claude Code session"** (the main/judge model — currently Fable 5), NOT the fixed `claude-opus-*` model. When the user switches the session model, every "opus" reference follows it. The worker tier "sonnet" remains literal sonnet. Same convention in `buildflow`/`deepflow` and the CLAUDE.md Agent-ops section.

The core reflex (conserve opus; sonnet = gather/locate/execute/verify, opus = judge/compose/decide/see; writes serial; don't delegate trivial one-offs) is always-on in `~/.claude/CLAUDE.md`. Load this right before spawning agents.

> **Canonical home.** This skill is the single source of truth for delegation/execution mechanics — **model-per-tier**, **Workflow offload + the "idle" (fire→signal→resume) model**, **Report envelope**, **fan-out tiers/caps**, **code-work division**. `buildflow` and `deepflow` *reference* these (their "Composition" / "Model split" sections) rather than restating them; on any conflict, this skill wins. The execution substrate itself is the built-in **`Workflow` tool** — its description is canonical for tool semantics.

## Core strategy — opus is the bottleneck, not the budget
- **Goal = time + quality** (not cost). sonnet is abundant; push heavy reading/exploration/first-pass/surveys to it so raw text never enters opus's context. opus is the serial bottleneck and the highest-value judge — keep it for judgment, not fetching. (sonnet still bills sonnet rates; fan out for coverage/time/quality, not by reflex.)
- **Opus-only (non-delegable):** deployment planning · load-bearing synthesis · ask-back/approval · risky-write decisions · prose composition · "see"-judgment. Everything else "read & organize" → sonnet.

## Reasoning-depth gate — the #1 opus cost lever
opus cost is dominated by **output** (thinking + visible text, ~5× input) plus the **cached context re-read every turn**; long opus turns inflate both. So **reasoning/output length, not subagent volume, is the bottleneck.** Scale thinking to stakes.
- Enforced by the report **ROUTE token** (see Report envelope): on a return, **obey ROUTE, don't re-deliberate.** Deciding "should I read deeper?" by reasoning IS the cost — the agent pre-encodes it in ROUTE; opus follows by reflex.
- The effort/thinking setting is the hard ceiling; this gate is the per-turn soft throttle.

## Workflow offload & unattended runs — the structural cost lever

> **★ STRONG RULE (user-mandated default — applies whenever the user has opted into multi-agent work):** substantial or multi-agent work MUST run as a **`Workflow` in the BACKGROUND**; **opus stays IDLE until it completes**, then reads only the final structured result. Do **NOT** block opus with a foreground parallel `Agent` fan-out for multi-step / multi-agent / implementation work — that keeps opus active and burning context the whole run, which the user has explicitly rejected. Foreground `Agent` is reserved for **1–2 genuinely one-shot lookups**. Anything that fans out (>2 agents), loops, pipelines, or implements across folders → **Workflow** (launch → opus turn ends → resume on the completion notification). opus's only foreground roles around a Workflow: author the script, then (on completion) integrate/commit/verify. This is a hard default, not advisory.
> **"Idle (유휴)" precisely:** fire → **the opus turn ENDS** → reactivate only on the completion signal → do the load-bearing part (synthesis/verify/commit) → fire the next → end again. Even a critique/lens **panel** goes into a background Workflow. deepflow/deepflow-auto are built ON this (each round: fire critique-Workflow → idle → synthesize on signal → fire improve-Workflow → idle → verify/commit) — opus-in-the-loop and "idle" coexist because opus is active only at completion signals.

The reasoning-depth gate trims one turn; **Workflow** trims the whole run. Mechanizable work (loop-until-dry, fan-out over a work-list, per-item verify, implementer worktrees) → encode as ONE `Workflow` script: opus writes it once and reads only the final structured result; sonnet agents run in the background.
- **⚠️ Set the model per tier — the #1 Workflow footgun.** `Workflow`'s `agent()` **defaults to the session model (= opus), NOT sonnet** (unlike the `Agent` tool). Never rely on the default; set `model` on EVERY `agent()` by tier: **work / verify / lens → `'sonnet'`** (no haiku). Load-bearing judgment is **not an `agent()`** — opus owns it outside the script; in-script `model:'opus'` only if it must live inside the loop (rare — justify). Omit `model` → the whole offload silently runs on opus.
  - **Pipeline caveat:** `pipeline` stages auto-propagate without review, so a load-bearing mid-stage isn't sonnet-solo — pull it out to opus, or append a sonnet adversarial-verify stage. (Script body = plain JS = free; only `agent()` bills a model.)
- **Tell-tale you should've used Workflow:** the same fan-out → judge → fan-out across N manual opus turns (an adversarial convergence loop; "spawn 10, read all, spawn verifiers"). N judge-turns over a growing transcript = the cost the user feels. One `loop-until-dry`/`pipeline` = one opus read.
- **Agent vs Workflow:** a couple of one-shot delegations → `Agent` (parallel in one message). Multi-stage / looping / >~6 agents → `Workflow`. Default to Workflow once it loops or pipelines.
- **Opt-in mandatory.** `Workflow` runs only on user opt-in ("ultracode", ultracode-on session, or an explicit "use a workflow / fan out / orchestrate"). Else propose it + rough cost; don't auto-launch.
- **Cron/ScheduleWakeup ≠ cost savings.** They re-invoke opus across context-resets for **unattended** progress (or surviving context limits); each wake past the 5-min cache TTL is cache-cold = pricier. Workflow = cost offload; Cron = unattended continuation (higher per-turn cost, knowingly).

## Spawning an agent (the `Agent` tool)
- **Model = sonnet (no haiku).** Set `model:'sonnet'`. Only complex design / subtle judgment / final synthesis stays opus.
- **Raise reasoning via the prompt** — `think hard`, escalate to `ultrathink` for reasoning-heavy work (no effort param; the prompt is the lever).
- **Output style = caveman-ultra** (instruct in the prompt): enumeration/data ultra-compressed; judgment·caveats·VERBATIM blocks never compressed (Report envelope rule).
- **Evidence-grounding (mandatory for factual/research/feasibility tasks).** Instruct the agent to **web-search for grounds, not lean on its embeddings.** In the Report envelope, `[fact-cited]` means a **real source** (URL / file / run-output), never recall. Any factual/version/pricing/API/feasibility claim with no source → tag `[assumption]` + lower confidence, never dressed as fact. (Calibrate: skip search for pure logic/mechanical tasks.) Embedding-only assertions are the #1 hallucination vector.
- **Output = the Report envelope below.**

### High-output tasks — MAX agents, never single-shot (★ 32k output cap)
A single agent's response is hard-capped at **32,000 output tokens** — exceed it and the agent **fails with "response exceeded the 32000 output token maximum"** (observed: a "rewrite the whole 65k-char report" agent died here, returning nothing after a full run). So for any task that *emits a lot of text* — writing/rewriting/translating long files, generating docs, full-content edits, large structured dumps — **fan out to the maximum useful number of agents; never hand one agent the whole body.**
- **Split by natural unit** (section / chapter / file / chunk) so each agent's *output* stays well under 32k (aim ≤ ~8–10k each, big margin).
- **Each agent writes its chunk DIRECTLY to a file** with the Write tool and returns **only the path + stats** (ROUTE: relay) — it must **never re-emit the full body into its response** (that's what blows the cap). The "compressed-return" rule applies doubly here: the artifact lives on disk, not in the report.
- **opus reassembles from files** (a cheap script `cat`/concat), not by reading every chunk into context.
- **Estimate before delegating:** output chars ÷ ~3 ≈ tokens. >~20k expected output → split, don't gamble on one agent. When unsure, over-split — extra agents are cheap, a failed full-run wastes the whole run.
- Pairs with **Workflow**: a `pipeline`/`parallel` over the chunk-list with per-chunk `schema` (each returning `{path, stats}`) is the clean encoding of this.

## Report envelope — the sonnet→opus contract
A two-party contract: sonnet emits a structured report; **opus obeys the read-protocol by reflex (never read-all).** Goal: maximum decision-value + reliability in minimum opus reading. (This subsumes the old omission-ban rules, coverage self-report, and compressed-verify return — one envelope.)

**① Spawn contract (opus, at delegation time).** When you delegate, tag the task once: **`sonnet-solo`** (user-read · reversible · doesn't auto-propagate without review) vs **`load-bearing`**. This fixes the report shape and the default ROUTE — decided once now (cheap, part of writing the delegation), never re-deliberated on return.

**② Send side (sonnet)** — layered for progressive disclosure:
- **L0 header (always):** `ROUTE: relay|judge|respawn|escalate` · `STATUS: done|partial|failed|refused` · one-line `TLDR`.
- **L1 reliability (always):** `coverage: census|sample(N/M)` · `confidence: H/M/L + basis` (calibrated, never bare) · `not_seen` · `truncated_due_to: none|context|time|cap` · `assumptions` · `self_falsify` (what would flip this / weakest point).
- **L2 payload** (below a `─── opus: stop here if ROUTE=relay ───` delimiter): tier-specific (below); each claim tagged `[fact-cited|inference|assumption|base-rate]`; a **VERBATIM block** (strings/numbers/IDs/paths/quotes/causal-chains) that is **never compressed**.
- **`signal` (always, compression-resistant):** anything important that didn't fit the fields — raw; "none" if truly nothing. The overflow channel against force-fit/omission.
- **L3 for_opus (load-bearing only):** `decide` (what opus must judge) · `pointers` · `open_questions`.

**③ Receive side (opus)** — read L0's ROUTE and **act by reflex, don't re-reason:** `relay` → emit "done + location + L1 flags" in 1–2 lines, stop (don't read L2); `judge` → read payload, reason; `respawn` → re-spawn (failed/partial); `escalate` → sonnet found something stake-changing → read it, raise to user.

**Two symmetric failure modes to guard:**
- **Over-compress (send):** sonnet's real finding never reaches opus. Defenses — the `signal` channel; **the discoverer upgrades richness** (sonnet may set ROUTE=judge/escalate and carry the full finding even if spawned `sonnet-solo`; *what reaches opus is decided by the sonnet that found it*); **judgment + caveats are never caveman'd** (only enumeration/data is); self-check "can opus act without re-reading what I read?"
- **Over-read (receive):** opus reads full every time = contract void. Defenses — ROUTE is a command not a hint; the delimiter makes the lazy path the correct path; `sonnet-solo` returns a minimal shape so there's no payload to "decide" about.

**Tier payloads (L2):**
- **work** (scout/gather): enumerated `items` (declare count N) + `file:line` pointers + structure map; `count_check: N==N`.
- **verify** (machine-check): `pass` (count only) + `fail` (each verbatim: source · location · reason).
- **lens** (opinion/council, e.g. deepflow): fixed order `stance · reasons · killer_point · risks · flip_condition · confidence` (enables stance-vs-stance comparison across the panel).

Force a `schema` (structured output) wherever the runtime allows (Workflow `schema`, etc.) so missing fields surface.

## Fan-out
- **★ 팬아웃 사전 허락 의무 (user directive 2026-07-20).** 팬아웃(Workflow 포함) 기동 전 **예상 에이전트 총수와 단계별 내역을 사용자에게 보고하고 허락을 받는다.** 기성 워크플로(deep-research 등)는 내부 검증 투표 같은 배수 단계까지 추산해 총수를 제시(실측: deep-research가 claim별 3표 검증으로 66 에이전트까지 팽창 — 사용자가 과하다고 판정). 예외 = 1~2개 단발 조회(보고만). 승인 범위 내 resume는 재허락 불요, 승인 수 초과 예상 시 재허락.
- **① deployment plan** (how many, each scope) → **② parallel activation** → **③ opus synthesizes — only if load-bearing** (else ROUTE handles it; review-optional results go straight to the user).
- **3 tiers + caps (empirical start, max within reliability):** work (explore/gather) ~10 / verify (machine-check) ~2 / lens (opinion — deepflow lenses, buildflow adversarial). Not hard ceilings — the max that doesn't hurt opus's ability to synthesize sharply; sonnet is abundant, raise where it helps quality. **verify-2 caps machine-verification only; lens is a separate tier.**
- **Parallel = read/explore only; writes serial** (concurrent edits corrupt). **Parallel-write pattern:** each agent owns one folder = one `isolation:'worktree'`; shared files (types/config) + final merge stay opus.
- **Parallel needs TRUE independence (even across worktrees).** A producer→consumer dependency — one agent's output is another's input — is not parallel: pipeline the stages or pre-stage the shared input. Co-parallel producer+consumer → the consumer fabricates a stand-in from the missing input (observed in a buildflow ③ build). Map producer→consumer deps before fan-out.
- **Plan & fan out only when parallelism pays** — single lookups / trivial commands: opus direct.

## Division by task type
sonnet = gather/locate/execute/mechanically-verify; opus = judge/compose/decide/see. Dividing line = "verbatim+judgment, or just fetching?"

| Task | sonnet (delegate) | opus (direct) |
|---|---|---|
| Human-read writing (자소서·회의록·papers·reports) | gather + extract source verbatim + layout | composition (remove AI-tells, 음슴체 voice) |
| Doc-file editing (hwpx/pptx/docx) | run scripts + rule-4 validation, report | final "OK to deliver?" call |
| Research / info-gathering | search/fetch/extract (sonnet-heavy) | synthesis + adversarial verify — only if load-bearing |
| Design (slides/figures/Figma) | scan/export/render | judge aesthetics from the render (subtract, calm) |
| Diagnosis / debugging | locate symptoms, collect logs | root-cause + fix decision |
| File cleanup / survey | exhaustive mapping / content diff | cleanup plan / delete decision |

- **Verbatim-body trap:** when user text must not change one char (자소서/회의록), opus places the verbatim source itself; sonnet only gathers.
- **"see"-required:** design aesthetics / render checks / figure integrity need the image in opus's context — opus looks directly, never trust sonnet's "looks fine."

## Code-work division (precise edits = opus, exploration = sonnet)
Precise edits can't run off summaries — opus must see the code verbatim. But opus needs the surgical site, not the whole repo.
- **① sonnet scout** — which file/function / all call sites / deps & data flow; return `file:line` pointers + structure map. No summarizing code (verbatim snippets or pointers, nothing between).
- **② opus precise** — Read only the pointed files → design, logic edits, review.
- **③ sonnet verify** — run tests/lint/build, report failures verbatim; repetitive mechanical edits (rename, signature propagation) too.
- **Implementer completeness:** an agent that *writes* code reads its whole assignment (spec/contract + existing files it will touch) with zero omission, reports coverage, before editing. (skim-then-write = drift.)
- **opus owns integration & contracts** — cross-chunk interfaces, integration, merge are never delegated. **Author the shared-interface SoT FIRST** (shared types/field-names/enums/error-codes/serialization/wiring), before any parallel per-chunk drafting; independent drafts then reconcile = N-round churn.
- **Reuse structure maps** (save as `.md` for next session), but per the canonical-check routine, Read the target file again just before editing.
