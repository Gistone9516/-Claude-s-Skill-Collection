---
name: verify-fanout
description: Indexing protocol for documents and code — how to write so later sessions can check, how to search the index instead of re-reading, and how to run agents and scripts in the right order. Read before editing an unfamiliar module, before asserting something exists or does not exist, before finalizing a spec, and before auditing inherited code. Triggers - 검증, 확인, 대조, 감사, 인덱싱, 색인, "정말 없나", "원문 맞나", spec 확정, 이식 검토, 모듈 수정 착수, verify, audit, drift check.
---

# verify-fanout — index it, search the index, verify cheaply

## 0. The failure this prevents (measured 2026-07-29)

A session holds a part, never the whole. So its defects share one signature: **locally reasonable, globally wrong.** Measured in one project, all AI-authored:

| Defect | Why it looked fine locally |
|---|---|
| Two counters for one quantity | Added at different times; each addition was correct |
| `body.tier` trusted as fallback | Its own comment says "if gating is absent, fall back" |
| A tier-override reimplemented elsewhere | The existing implementation was not in view |
| Same model id hardcoded in two packages | Same |
| A screen replaced but never deleted | The replacement was the only thing in view |

Second measured fact: **the session asserts false things with full confidence.** Real case — "the contract has no `difficulty` field", stated flatly after reading lines 93-99; it was on line 100. Therefore artifacts must make claims checkable rather than trusting the operator's calibration.

**Corollary that governs this file: agents discover new defect shapes, scripts remember known ones.** A script only finds what someone already encoded. Code work continuously produces new shapes, so for code the agent leads and the script ratchets. Measured: an agent audit found 9 defects; a script written afterward reproduced 4 and hard-failed 2. The script itself shipped with 5 bugs, found only because the audit had already produced ground truth. **A script without an oracle is untrustworthy.**

## 1. Four modes — pick before spending anything

| Mode | When | Cost | Owner |
|---|---|---|---|
| **brief** | before editing a module you did not just write | low | agent, reads the index |
| **verify** | before asserting provenance; before finalizing a spec | low | script first, then agent for leftovers |
| **sweep** | inherited/ported code; periodically | high | agent, free lens |
| **ratchet** | after sweep finds a mechanizable shape | one-off | script |

Running the wrong mode returns nothing and costs the budget anyway.

## 2. Write so it can be searched — documents

- Every normative statement carries an **ID** (`B-1`, `D-2`). A rule with no ID cannot be cited, so a later patch reverses it silently.
- Every ID carries **source, rationale, test**. Rationale is load-bearing: without it a future session "improves" the rule and restores the original problem.
- The header states **ID ranges and counts** (`규칙: B-1~B-16 (16건)`). A gate greps and compares. Adding a rule without updating the header fails the count. Drift becomes impossible to hide instead of something to remember.
- **Normative and narrative sections are separated** so a reader can skip narrative without losing a rule.
- Any provenance claim ("v1 원문", "이미 있음", "없음", "사용자 확정") is a claim and gets verified before the document is final. Measured failure: an AI-written code comment ("디자인 변경 금지") was lifted into a spec, labeled `(사용자 확정)`, then quoted back to the user as their own decision. **A label is not a source.**
- **Do not create a new document for repeated work. Revise in place.** Two documents stating the same rule is the doc-layer version of two counters.
- **When a document is wrong, correct it — do not annotate it (user directive 2026-07-29).** Write what is true now. Do NOT add "개정 사유", "원래는 X였으나", "실측 결과 틀렸다", or a dated correction note. Git holds the history; the document holds the state, and change-log prose makes it dirty and progressively unreadable. **Distinguish two kinds of "why":** a *rule's* rationale is load-bearing and stays (it stops a future session from reverting the rule); a *document's* change history is not and goes.
- A protocol lives in exactly one file. Project docs **reference** it; they do not restate it.

## 3. Write so it can be searched — code

- **No exported symbol without a consumer in the same commit.** Inert exports get mistaken for working behavior.
- **One decision, one implementation.** If tier resolution / quota check / key normalization already has a function, call it.
- **Values that must agree live in one place and are imported.** Never two literals synced by convention.
- **Derivable values are functions, not fields.** A comment saying "recomputing is authoritative" next to a stored field is a confession.
- **Authority never comes from request input.**
- **Every branch must distinguish.** Identical arms, or a condition no call site varies, is dead.
- Naming is part of the index: a symbol should be greppable by what it *is*, not only by what it does.

## 4. Search the index — routing before reading

**Never re-read a package to answer a question the index answers.** Route first:

| Question | Look here first |
|---|---|
| Who consumes this symbol / is it dead? | generated relation index |
| What does this package expose? | barrel `index.ts` |
| Where does responsibility X live? | package README structure map |
| What rules govern this area? | spec's ID table (header count tells you if it is current) |
| Was this promised somewhere? | doc markers (`[개정]`, `[신규]`, `[v1 원문]`) |
| Does this exist at all? | **cannot be answered by search — see the two rules below** |

Order for an unfamiliar package: **index → barrel → README map → only then the modules the question touches.**

### The two soundness rules

- **Read whole units, never line windows.** An interface from `{` to `}`, a section to the next header. Measured failure: `offset 93, limit 7` concluded a field was absent; it was on line 100. A fixed-size window is how you miss the last member of anything.
- **grep returning nothing is not proof of absence.** It is "not found by this pattern". To assert absence, read the whole unit that would contain it, and search the whole document *set*, not one file. Measured failure: grepping only the SoT and reporting a revision as unimplemented, when a sibling spec recorded it as a deliberate deferral.

## 5. brief mode — runs first, always

**Standing exception (user directive 2026-07-29).** The brief agent is exempt from fan-out pre-approval, from any "spawn agents only when asked" restriction, and from ordering behind the rest of the preamble. Do not ask for it; do not count it against an agent budget. Rationale: gating the brief inverts its purpose — it exists to be cheap enough that it always runs, and anything conditional gets skipped exactly when the session is busiest, which is when the locally-reasonable-globally-wrong defect appears.

**Scope is every task, not only code** (same directive: "어떤 작업에서나 선행하여 정확도를 올릴 것"). Documents, specs, config, prose deliverables — any artifact not authored in this turn.

Before editing something you did not just write, spawn one agent with the relation index and the target path. It must return **3-5 decision-shaped lines, not a relationship dump**:

```
이 모듈을 고치기 전에
1. tier 판정은 AuthService.resolveTier에 이미 있다. 새로 만들지 말 것
2. turns_left는 answers에서 파생 가능하다. 저장하면 이중 카운터가 된다
3. 이 상수는 providers/deepseek/client.ts와 같아야 한다
```

Rules that keep it useful:
- **It must be able to answer "주의할 것 없음".** An agent that must find something every time becomes noise, and noise gets skimmed, and skimmed equals not run.
- Shape is imperative: *do not build this / it already lives here / this must agree with that*. Not "here are the relationships".
- It reads the **index**, not the repository. That is what makes it affordable per edit.

Measured: `DEV_FORCE_TIER` reimplementation, duplicated model ids, and the stored `turns_left` would each have been prevented by one such brief.

## 6. verify mode — claims from documents

1. **Extract claims from the document's own markers**, never from memory. What you fail to recall is exactly what stays unchecked.
2. Turn each into a **closed question**: "Does X exist at file:line? yes/no + one quoted line."
3. **Script first** — if grep or a count answers it, spend no agent.
4. Batch leftovers 5-8 per agent, `model:'sonnet'`, schema `{claim_id, verdict, citation}`, no prose, **default to REFUTED when uncertain**.
5. Read only REFUTED and UNVERIFIABLE. Confirmed claims are a count.

## 7. sweep mode — new defect shapes in code

Free lenses, one agent per lens, read-only. Lenses that paid off: symbol with no consumer, one quantity two fields, one decision two implementations, authority from input, branch that cannot fire, platform assumption surviving a port, doc promise absent from code.

**Model tier is NOT set here.** `agent-ops` owns model-per-tier and its default stands for every agent this protocol spawns. This file does not override it. (A 2026-07-29 clause promoting findings agents to the session model was added and then rolled back at the user's correction — do not reintroduce it.) The division that governs: **agents gather and propose, opus judges and decides.** Every step of this protocol that involves judgment — adopt/reject a finding, classify a bug, decide scope, call convergence — is opus's own work and is never delegated.

### 7-1. Partition the search surface — 주요 파일 and 혹시 모르는 파일 (user directive 2026-07-29)

An agent told to "audit this package" gravitates to the files that look important and skims the rest. The rest is where things hide. So **the prompt must partition the surface explicitly and demand coverage of both halves:**

- **주요 파일** — the modules the question is obviously about. Name them by path.
- **혹시 모르는 파일** — everything else in scope: barrels, fixtures, i18n resources, mocks, generated or copied assets, config, scripts, styles. Name the *directories* and require the agent to enumerate what it actually opened.

Require a coverage line per half. An agent that read the main files and skipped the tail must say so rather than reporting a clean result.

Measured 2026-07-29 — defects that lived entirely in the tail: a screen replaced but never deleted, three fully-authored locale resources with zero consumers, a ternary with identical arms inside a helper, dead selectors for a UI generation that no longer exists. **None of these are in a file anyone would call 주요.**

**Optimize these agents for recall and citation quality, NOT precision.** Counterintuitive but measured: a panel that is right 95% of the time makes the operator stop checking, and then the wrong 5% ships carrying the operator's full confidence. Uncertainty is what forces the operator back to the source, and going back to the source is where the real finding happens.

Measured 2026-07-29, both from the same audit:
- A finding was **wrong** (`effectiveEntitlement` "ignores a field"). Checking it made the operator read an SoT clause never read before, which the code in fact satisfied. Cost: one grep. Value: a contract now known.
- A finding was **right but understated** ("same model id in two files"). Checking it exposed a silent-downgrade fallback — pay for pro, receive flash, no error — far worse than the reported duplication. **A perfect finding would have produced a smaller fix.**

The condition that makes this a virtuous cycle rather than noise: **refutation must be cheap.** Require `file:line` plus the verbatim quote on every finding, and a `confidence` field. Low confidence is welcome when cited; uncited assertions are not, because they turn checking into an investigation and the operator starts skimming — and a heckler who gets tuned out has stopped working.

The operator's duty, correspondingly: **never adopt and never dismiss on the agent's say-so.** Judge each finding against the source material (코드규약 §7 classification applies). A clean result is valid and valuable; state its blind spots, because a clean result with unstated blind spots reads as "nothing is wrong", a stronger claim than was actually checked.

## 8. ratchet — turn a found shape into a permanent check

When sweep finds a shape that is countable, encode it in the project's index script so it can never return for free. Gate policy:

- **Hard-fail only invariants with no legitimate exception** (identical branches, authority-from-input, duplicate definition of a registered must-agree constant).
- **`readers=0` must not hard-fail** — a legitimately unconsumed export exists when its consumer arrives next slice. It belongs in the committed index, whose **diff** is the signal.
- Exceptions go in an ALLOWLIST **with a stated reason**. Visible, not hidden.
- **Validate a new check against known answers before trusting it.** Measured: an indexer shipped with 5 defects (missing `export *`, missing `type_identifier`, missing namespace imports, single-pass comment collection, pseudo-classes counted as classes). Four of them silently produced false positives at scale; one silently produced a false negative on the exact field it was written to catch.

## 9. What no mode covers

Runtime-only relationships (string-keyed lookup, dynamic import, reflection) · structural CSS selectors (dead *classes* are visible, dead *structures* are not) · semantic duplication under different names · **anything never written down anywhere**.

## 10. New lessons

Add measured lessons here with dates. Reusable protocol → this file. Project-specific binding (paths, allowlists, script location) → that project's docs, by reference.
