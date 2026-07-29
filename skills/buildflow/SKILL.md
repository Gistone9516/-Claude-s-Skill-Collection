---
name: buildflow
description: Multi-cycle plan→design→build workflow for vibecoding. Operator Opus owns planning, spec (contracts), integration, and gates; work is split by folder and implemented in parallel by sonnet agents; the spec doubles as a debug index across N cycles. Triggers "기능 구현해줘", "바이브코딩", "기획-설계-구현", "spec-driven 병렬 구현", "buildflow". Not for a single-file edit, a one-line bug, or pure exploration (use agent-ops/deepflow directly). Adversarial council = deepflow, delegation/model discipline = agent-ops — both called as components.
---

# buildflow — plan → design → build workflow

Rules: BF-1..BF-6 (6), tagged on the load-bearing points only; the stage and cycle headings carry the rest of the procedure. Section order is execution order, not importance.
Execution mechanics are canonical in `agent-ops`; change discipline in `work-rules-diagnosis`; delegation policy in `agent-ops`.

> **Terminology (user directive, 2026-06-10):** "opus" / "Operator Opus" in this skill = **the model currently applied to the Claude Code session** (role name), not the fixed `claude-opus-*`. "sonnet" stays literal. Canonical definition: `agent-ops`.

## Definition & principles
**Operator Opus** owns planning, design, spec, integration, judgment and gates. **Implementer sonnet** runs adversarial lenses, parallel implementation and verification. Four principles:
1. **BF-1 Correct beats predict** — do not interrogate to perfection. Show cheap concretes (a spec, a slice) fast and correct from the reaction.
2. **BF-2 Three alignment checks** — user intent (vertical), adversarial-agent integrity (horizontal), and a thin-slice reality check. Only a spec that passes all three goes to parallel build.
3. **BF-3 Anti-infinite** — no unbounded twenty-questions or review. Close with gates and dry convergence.
4. **BF-4 Volume is not verification** — "N agents looked at it" is not robustness. opus gates agent output against the target.

## Master flow
```
╔══════════════ N cycles (discrete shippable increments) ══════════════╗
║ enter → [planning mode]                                              ║
║   A: planning always user-reviewed (default)                        ║
║   B: opus plan ⇄ sonnet×3 adversarial ⟲ until 2-dry → design        ║
║      └ new intent / prior-plan change / non-convergence → user      ║
║ ① plan  intent + partition map (folder split / spec files ≤~400ln·5k) ─G1→ ║
║ ② spec  per-folder contract (type sigs·schema·error rules)          ║
║         + adversarial integrity review + user red-pen ──────────G2→  ║
║ ③ build folder = git worktree = sonnet 1                            ║
║         read whole assignment first (0 omission, coverage)          ║
║         thin slice first → integrate·merge·test = opus              ║
║ ④ close regression+new verify · spec↔code resync (git gate)         ║
║ ⑤ next cycle? → [cycle-criterion triage]                            ║
╚══════════════════════════════════════════════════════════════════════╝
 persistent state: partition map · .md contracts · code · tests · debug index
 debug index: error → opus localizes to a partition via the spec → re-spawn that sonnet
```

## Stages
### ① Plan (WHAT/WHY + skeleton) — the most upstream SPOF
A wrong plan discards spec + build ×N. Highest leverage.
- **opus:** finite twenty-questions for intent (stop once a contract draft is writable) + **partition design** (folder split + spec-file inventory, each ≤ ~400 lines/5k tokens — sized so an agent can reference the whole spec at once, not arbitrary).
- **sonnet adversarial lens** (deepflow): output is not a verdict but **"questions for the user · hidden assumptions · missed alternatives"** → compresses the twenty-questions.
- **G1:** intent + partition map ratified by the user (A-mode) or via the B-mode loop.

### ② Design·spec (HOW = contract) — the build SPOF
- **opus — SoT-first (shared interface BEFORE per-folder contracts).** When contracts share cross-cutting interfaces (shared types · field names · enums · error codes · **serialization schema** · **runtime wiring**: global names / boot entry / config format), opus authors ONE shared-interface SoT (`_인터페이스계약.md`) **first**, then per-folder contracts are drafted/conformed **against it** (the SoT is authority — "on conflict, SoT wins"). Drafting per-folder contracts independently and reconciling afterward = N-round churn (observed: **7 rounds** on a 6-contract spec — card_id vs id, grade vs score_mode, blanks shape, tags nesting). The cross-contract surface is opus's, fixed up front.
- **opus:** per-folder spec as a **persistent `.md` contract** — *machine-verifiable* interfaces (type sigs · data schema · error rules), not prose. Over ~400ln/5k = a signal to split.
- **sonnet adversarial integrity review** (deepflow, horizontal): undefined contracts · missed edges · internal contradictions · over-spec. opus cuts nitpick/over-spec.
- **user red-pen** (vertical, intent): reviews the spec `.md` directly.
- **G2:** red-pen (intent) + adversarial (integrity) pass.
- **Reconcile gate (anti-infinite):** when integrity-checking multi-contract conformance, the checker classifies each residual **BLOCKING** (a real cross-contract break the SoT doesn't resolve — type/field/signature/missing-function) vs **NON_BLOCKING** (local wording the SoT already overrides). Converge at **BLOCKING=0** — don't chase SoT-overridden cosmetics (that's the anti-infinite principle made checkable).

### ③ Build (#1 value: time)
- **BF-5 opus:** decompose into partitions, then **one folder = one git worktree = one sonnet** in parallel (cap per `agent-ops` AO-13). Each sonnet edits **only its worktree**; **shared files (types, config) and the final merge stay with opus** — this is the explicit worktree exception to `agent-ops` AO-14 "writes are serial". opus resolves merge conflicts from the conflict markers and re-spawns the sonnet if needed. At larger scope the partition itself becomes the deliverable: each unit must be independently checkable and its check written with it (`agent-ops` AO-23).
- **Parallel build = truly independent partitions only** (`agent-ops` AO-14). Producer to consumer is never co-parallel — pipeline the stages or pre-stage the shared input, because a consumer without its input invents one (`ai-characteristics` AI-6).
- **sonnet hard rule:** before starting, read the **whole assignment (own spec + related/existing files in the folder) with zero omission** → coverage self-report.
- **thin slice first** (reality check): build one partition → user reaction → contract OK → *then* fan out the rest.
- **integrate · merge · integration-test · precise-edit · logic = opus** (not delegated).

## Cycle (N)
- **persistent state:** partition map · `.md` contracts · code · tests · debug index. (per cycle = delta plan · touched folders · spawned sonnet · integration)
- **blast-radius at entry:** additive (new folder) / internal (within a folder) / contract change (cross-folder, propagating).
- **regression defense:** whole-read + verify extend to *existing* code; close-verify = new + regression.
- **close = spec↔code resync** → structurally blocks spec drift (next cycle's debug index stays clean).
  - **git gate (auto-detect):** cycle close = commit + tag. The close gate checks via `git` that the spec `.md` and the touched code landed in the **same commit range** → if a folder changed code but not its spec, **block next-cycle G1** (force resync). A verifiable gate, not a declaration.
  - **rollback** = `git revert`/reset to the cycle tag (git reverts the textual persistent state).

## Cycle-criterion triage (autonomy)
```
opus first-pass
 ├ [major] → user (required): intent/scope change · cross-folder public-contract change ·
 │           irreversible/external (data·schema·auth·payment·API·deploy) · genuine ambiguity
 └ [minor] (additive·internal·bug·contract-fulfillment) → sonnet×3 adversarial check (㉠contract·propagation ㉡regression ㉢intent·scope)
       ├ 0 flag → auto-proceed
       └ flag → opus review/reclassify → clear false-positive → auto + FYI · genuine/uncertain → user (required)
```
Asymmetric risk: a missed major ≫ an unneeded check → when unsure, lean to the user.

## Planning modes A / B
- **A (default):** planning always user-reviewed.
- **B (explicitly granted):** opus plan → sonnet×3 adversarial → opus re-judge ⟲ **until 2 consecutive dry (0 new meaningful)** → design. Adversaries: "only NEW weaknesses each round, rebut the plan." Hard round cap (default 5) — at the cap with real issues still surfacing = non-convergence → user.
  - **B autonomy ceiling = derivable improvements** (bugs · completion · hardening · tech-debt · backlog). *New intent/direction* or *prior-plan change* → user. Autonomous planning/convergence = FYI log (guards self-grading bias).
  - **B = continuous autonomy across the whole cycle**, not just planning: unless a triage-major hits (intent/scope · irreversible/external · non-convergence · hard-floor failure), run ②→③→④→next cycle autonomously. Don't stop at stage gates for routine approval. (May vary by user — check user memory.)
  - **Execution = Workflow offload** (agent-ops, opt-in): run the adversarial convergence loop, ③ worktree fan-out, and ④ verify as `Workflow` scripts → short opus turns. opus keeps ② contract finalization, integration/merge, risky-writes, triage.
  - **Unattended (away):** if the user wants, `CronCreate`/`ScheduleWakeup` to wake → run the next Workflow phase → escalate only major / hard-floor. Not a cost saving (cache-cold); for unattended continuation only.
  - **BF-6 Non-blocking autonomy (park and continue) — for full-delegation runs.** When the user grants full authority to complete a large scope unattended, do NOT stop and wait on each decision:
    1. **Resolve by evidence first.** For any uncertainty, try **multi-agent web-search verification** (parallel sonnet, web-grounded per CLAUDE.md G-09 — never from embeddings). Resolvable → resolve and FYI-log.
    2. **Park, don't block.** If it genuinely needs the user (taste · ambiguous intent · irreversible/external), **append it to a running decisions-log file (e.g. `_사용자판단대기.md`) and SKIP only that sub-part — continue the rest of the SAME task** (don't switch task/scope, don't halt the run). Never auto-execute an irreversible/external action — parking = safely not doing it + logging.
    3. **End briefing.** When all scoped work is done, produce **one briefing doc enumerating every parked decision** (context · options · recommendation) for batch review.
    - Hard-floor failures (test/integration fail, corruption) still **halt** — can't build on broken. Park applies to *decisions*, not to *broken state*.

## Cross-cutting rules
- **Hard floor (any class/mode):** regression/integration test fail → stop & report · irreversible/external/security → always user · spec resync always · accumulating auto-cycles → periodic summary.
- **git prerequisite:** buildflow assumes a git repo (cycle boundaries · rollback · merge · spec-drift gate are all git-based). Not a repo at entry → propose `git init` first.
- **Applicability:** parallelize only *independently decomposable* work (N CRUDs · tests · boilerplate · isomorphic migration · multiple components). High coupling → serial (Amdahl). Don't lay this down as a default reflex.
- **Debug index:** error → opus localizes to a partition via its spec → re-spawn that worktree's sonnet. (Strong on *in-partition* bugs; *boundary* bugs work only if the contract spells out the boundary → hence ②'s contract must be machine-verifiable.)

## Composition (component skills)
- **Adversarial council** = `deepflow`, **called in component mode:** buildflow supplies the decision/criteria/constraints, so deepflow skips §0–§1 (enters at §2; G1/G2 replace them) and the return feeds the gate. Uses: ① plan-questioning, ② spec integrity review, B-mode adversarial loop, triage's sonnet×3.
- **Delegation/model discipline** = `agent-ops` (model=sonnet · ultrathink · caveman · **Report envelope** · whole-read · folder=git worktree · integration=opus · tier caps work/verify/lens). Adversarial/lens = **lens tier**.
- **Autonomy engine** = `Workflow` tool (mechanics — idle model, opt-in, `model:'sonnet'` footgun — canonical in agent-ops "Workflow offload"). B-mode / multi-cycle cost lever: loop-until-dry (convergence) · pipeline (③ build · ④ verify) as deterministic scripts. Unattended via `CronCreate`.
- Agent outputs follow the **agent-ops Report envelope**.

## Checklist
| # | check |
|---|---|
| ① | mode (A/B) → intent + partition map (folders / spec ≤5k) → G1 |
| ② | per-folder machine-verifiable contract → adversarial integrity + red-pen → G2 |
| ③ | folder=git worktree=sonnet, whole-read/coverage → slice first → opus integrate (Workflow if opted-in, `model:'sonnet'`) |
| ④ | close: regression+new verify + spec↔code resync (git gate) |
| ⑤ | triage → next cycle auto/user |
