---
name: verify-fanout
description: Evidence grading and the indexing protocol for documents and code - how to write so a later session can check a claim, how to search the index instead of re-reading, and which of four verification modes to run. Read before editing a module you did not just write, before asserting something exists or does not exist, before finalizing a spec, and before auditing inherited code. Triggers - 검증, 확인, 대조, 감사, 인덱싱, 색인, "정말 없나", "원문 맞나", spec 확정, 이식 검토, 모듈 수정 착수, verify, audit, drift check.
---

# verify-fanout — grade the evidence, index it, verify cheaply

Rules: VF-1..VF-22 (22). Sections are ordered by how much a violation costs.
CLAUDE.md G-05..G-10 point here.

## 1. Evidence grades

**VF-1 There is no canonical source, only grades.** In descending order:

| Grade | Source |
|---|---|
| 1 | Execution output, measurement |
| 2 | The code itself |
| 3 | Two independent records, written at different times by different paths, agreeing |
| 4 | A single document |
| 5 | Recall |

State the grade when the answer rests on grade 4 or 5.

**VF-2 A document is not canonical.** Measured: an AI-written code comment ("디자인 변경 금지") was lifted into a spec, acquired a `(사용자 확정)` tag, and the next session quoted it back to the user as their own decision. The user had given no such instruction. A document recording a user instruction is still a document an AI wrote.

**VF-3 A label is not a source.** `(사용자 확정)` and equivalents are valid only when they can point at a decision record — a question-table row, a memory entry, a quoted message. Nothing to point at means unverified, and the report says so.

**VF-4 A session asserts false things with full confidence** (`ai-characteristics` AI-1). Measured: "the contract has no `difficulty` field", stated flatly after reading lines 93-99. It was on line 100. Calibration cannot be trusted, so artifacts must be built to make claims checkable instead.

**VF-5 The signature of a session's defects is: locally reasonable, globally wrong** (AI-3). A session holds a part, never the whole. Measured in one project, all AI-authored:

| Defect | Why it looked fine locally |
|---|---|
| Two counters for one quantity | Added at different times; each addition was correct |
| `body.tier` trusted as a fallback | Its own comment says "if gating is absent, fall back" |
| A tier override reimplemented elsewhere | The existing implementation was not in view |
| One model id hardcoded in two packages | Same |
| A screen replaced but never deleted | The replacement was the only thing in view |

## 2. Four modes — pick before spending anything

| Mode | When | Cost | Owner |
|---|---|---|---|
| **brief** | at task start, and at first contact with a new file group (VF-8) | low | a pair, one agent per lens (VF-21), reading the index |
| **verify** | before asserting provenance; before finalizing a spec | low | script first, agent for leftovers |
| **sweep** | inherited or ported code; periodically | high | agent, free lens |
| **ratchet** | after sweep finds a mechanizable shape | one-off | script |

**VF-6 Agents discover new defect shapes; scripts remember known ones.** A script finds only what someone already encoded, and code work keeps producing new shapes, so for code the agent leads and the script ratchets afterward. Measured: an agent audit found 9 defects; a script written from it reproduced 4 and hard-failed 2, and the script itself shipped with 5 bugs that were only visible because the audit had produced ground truth first. **A script with no oracle cannot be trusted.**

Running the wrong mode returns nothing and costs the budget anyway.

## 3. brief mode — runs first, always

**VF-7 Standing exception (user directive 2026-07-29).** The brief pair is exempt from fan-out pre-approval, from any "spawn agents only when asked" restriction, and from ordering behind the rest of the preamble. Do not ask for it; do not count it against an agent budget. Gating it inverts its purpose: it exists to be cheap enough that it always runs, and anything conditional gets skipped exactly when the session is busiest, which is when the locally-reasonable-globally-wrong defect appears. Two agents rather than one does not change that arithmetic — what is being weighed is not the agents but a plan built on a wrong premise and every commit that follows it.

**VF-8 The triggers are countable, not a judgement (user directive 2026-07-30).** The former wording — "before editing anything not authored this turn" — required a judgement at every edit, and `work-rules-automation` AU-22 applies to rules as much as to hooks: a threshold that must be judged is what gets skipped exactly when the session is busy. Run the pair at these four moments, and count them.

1. **Task start.** When the user names a new task, before reading the code and *before proposing a plan*. This is the one that pays. Measured 2026-07-30: a brief at this point overturned 4 of 7 assumptions in a plan that had already been written into a commit message the day before. A brief that waits for the first edit arrives after the plan is fixed.
2. **First contact with a new file group** — a package, directory or document set this task has not touched yet. `scripts/brief-nudge.sh` marks this moment at the edit itself; its per-session ledger makes it fire once per file, not once per edit.
3. **Resuming after a compaction.** A summary carries conclusions, not the constraints that produced them.
4. **When the user states a past decision from recall** (CLAUDE.md G-06). Check the documents and the code before agreeing.

Skip it — and say that it was skipped rather than passing over it silently — for a file created this turn, for a change that closes inside one file already read whole, and for a file group already briefed in this task.

**Scope is every task, not only code** (2026-07-29 directive: "어떤 작업에서나 선행하여 정확도를 올릴 것"). Documents, specs, config and prose deliverables all count.

**VF-21 The brief is a pair, one agent per lens (user directive 2026-07-30:** "최소 2대를 운영해야 에이전트를 사용하는 의미가 있다"**).** Two agents given the same prompt are not two judgements — they share priors and return the same answer (AI-4), so the second one only pays when its framing is different. Use the two that map onto the defect signature in VF-5:

| Lens | Its question | What it catches |
|---|---|---|
| **현장 the site** | What do the files I am about to touch actually say, and which of my assumptions about them are wrong? | *locally* wrong — a stale premise, a signature that is not what I remember, a table that has one column where I assumed four |
| **주변 the surroundings** | What outside my target already does this job, must agree with it, or goes stale once I change it? | *globally* wrong — a duplicate implementation, a constant that must match, a document that restates the rule I am editing |

Give each lens the half it owns **and tell it the other half is covered.** An agent that believes it is alone widens its scope to the whole surface, and then both come back with the same survey. Both go in a single message so they run concurrently (`agent-ops` AO-6).

Model tier is not set here — §8 governs, and `agent-ops` AO-4 puts a lens on sonnet. **"Lens" here names the framing only, not AO-18's lens payload** (`stance · reasons · killer_point · risks · flip_condition`): a brief returns imperative decision lines, per VF-10.

Measured 2026-07-30, the pair's first run: the site lens returned the rule numbering and byte budget the edit had to fit; the surroundings lens returned three files that restated the rule in the singular, one of them a hook script the operator had just reviewed line by line without noticing. Neither lens would have produced the other's list.

Give the pair the relation index and the target path. Each returns **3-5 decision-shaped lines, not a relationship dump**:

```
이 모듈을 고치기 전에
1. tier 판정은 AuthService.resolveTier에 이미 있다. 새로 만들지 말 것
2. turns_left는 answers에서 파생 가능하다. 저장하면 이중 카운터가 된다
3. 이 상수는 providers/deepseek/client.ts와 같아야 한다
```

**VF-9 Either lens must be able to answer "주의할 것 없음".** An agent required to find something every time produces noise, noise gets skimmed, and a skimmed brief is an unrun brief. This binds harder on a pair — the second lens is the one under pressure to justify itself.

**VF-10 Shape is imperative** — do not build this / it already lives here / this must agree with that. Not "here are the relationships". Each reads the **index**, not the repository; that is what keeps a pair affordable.

Measured: the `DEV_FORCE_TIER` reimplementation, the duplicated model ids, and the stored `turns_left` would each have been prevented by one brief pass.

## 4. Write so it can be searched — documents

- **VF-11 Every normative statement carries an ID** (`B-1`, `D-2`). A rule with no ID cannot be cited, so a later patch reverses it silently.
- **VF-12 Every ID carries source, rationale, test.** Rationale is load-bearing: without it a future session "improves" the rule and restores the original problem.
- **VF-13 The header states ID ranges and counts** (`규칙: B-1~B-16 (16건)`). A gate greps and compares, so adding a rule without updating the header fails the count. Drift becomes impossible to hide rather than something to remember.
- **VF-14 Normative and narrative sections are separated**, so a reader can skip narrative without losing a rule.
- **VF-15 Correct a wrong document; do not annotate it (user directive 2026-07-29).** Write what is true now. No "개정 사유", no "원래는 X였으나", no dated correction notes. Git holds history; the document holds state. Distinguish the two kinds of why: a *rule's* rationale stays because it stops a future session from reverting the rule; a *document's* change history goes.
- **VF-16 Do not create a new document for repeated work — revise in place.** Two documents stating the same rule is the document-layer form of two counters. A protocol lives in exactly one file; project docs reference it and never restate it.

- **VF-22 A decision gets a note at `_shadow/<same relative path>.md` (user directive 2026-07-30).** Specs and commits are addressed *by slice*; nothing tells a session which decisions govern **the file it is about to edit**. Mirror the repo tree under `_shadow/`, written as part of the work — **the main model writes it, not an agent** — holding only what the source cannot.

  Per decision: **what breaks if a later session does the obvious thing instead** — the load-bearing field, because "why we did it" does not survive a competent future session (AI-7) · a grade on every claim (VF-1 tags; ungraded claims get laundered into fact, VF-2) · a number only beside **a repo-committed command** that reproduces it · lists **pointed at, never copied** · when the note goes stale, including states the plan itself produces.

  And what no commit, spec or comment holds — **what that session knew**: read whole / not read / **did a brief run, and did it change the plan** / knowingly deferred / where in the session. If a past session's state cannot be recovered, say so; inventing it is AI-6.

  Measured 2026-07-30, three cold-read rounds with a fresh agent given only the note: the **brief sub-field is what discriminated.** Notes saying "a brief ran and moved the plan from 4 keys to 11" were reconstructible; the decisions with no brief were the ones the agent independently rated thin, and were where the defects were. A "what pressure forced this" field was tried and dropped as uninformative. Those rounds also killed a claim of mine — a partition summing to its own total is an **identity, not an oracle**, and it had been written as the sole evidence a script was correct.

## 5. Write so it can be searched — code

- **VF-17** No exported symbol without a consumer in the same commit. Inert exports get mistaken for working behavior.
- One decision, one implementation. If tier resolution / quota check / key normalization already has a function, call it.
- Values that must agree live in one place and are imported. Never two literals synced by convention.
- Derivable values are functions, not fields. A comment saying "recomputing is authoritative" next to a stored field is a confession.
- Authority never comes from request input.
- Every branch must distinguish. Identical arms, or a condition no call site varies, is dead.
- Naming is part of the index: a symbol should be greppable by what it *is*, not only by what it does.

## 6. Search the index — routing before reading

**VF-18 Never re-read a package to answer a question the index answers.** Route first:

| Question | Look here first |
|---|---|
| Who consumes this symbol; is it dead? | generated relation index |
| What does this package expose? | barrel `index.ts` |
| Where does responsibility X live? | package README structure map |
| What rules govern this area? | spec's ID table (the header count says whether it is current) |
| **What decisions govern this exact file, and what did they cost?** | its `_shadow/` note (VF-22) |
| Was this promised somewhere? | doc markers (`[개정]`, `[신규]`, `[v1 원문]`) |
| Does this exist at all? | not answerable by search — see VF-19, VF-20 |

Order for an unfamiliar package: **index → barrel → README map → only then the modules the question touches.**

**VF-19 Read whole units, never line windows.** An interface from `{` to `}`; a section to the next header. Measured: `offset 93, limit 7` concluded a field was absent when it was on line 100. A fixed-size window is how the last member of anything gets missed.

**VF-20 grep returning nothing is not proof of absence.** It is "not found by this pattern". To assert absence, read the whole unit that would contain it and search the whole document *set*, not one file. Measured: grepping only the SoT and reporting a revision as unimplemented, when a sibling spec recorded it as a deliberate deferral.

## 7. verify mode — claims from documents

1. **Extract claims from the document's own markers**, never from memory. What is not recalled is exactly what stays unchecked.
2. Turn each into a closed question: "Does X exist at file:line? yes/no + one quoted line."
3. **Script first** — if grep or a count answers it, spend no agent.
4. Batch leftovers 5-8 per agent, `model:'sonnet'`, schema `{claim_id, verdict, citation}`, no prose, **default to REFUTED when uncertain**.
5. Read only REFUTED and UNVERIFIABLE. Confirmed claims are a count.

## 8. sweep mode — new defect shapes in code

Free lenses, one agent per lens, read-only. Lenses that paid off: symbol with no consumer, one quantity two fields, one decision two implementations, authority from input, branch that cannot fire, platform assumption surviving a port, doc promise absent from code.

**Model tier is not set here.** `agent-ops` owns model-per-tier and its default stands for every agent this protocol spawns. (A 2026-07-29 clause promoting findings agents to the session model was added and rolled back at the user's correction — do not reintroduce it.) The division: **agents gather and propose, opus judges and decides.** Every judgment step — adopt or reject a finding, classify a bug, decide scope, call convergence — is opus's own work.

### 8-1. Partition the search surface (user directive 2026-07-29)

An agent told to "audit this package" gravitates to the files that look important and skims the rest (`ai-characteristics` AI-13), and the rest is where things hide. The prompt must partition the surface and demand coverage of both halves:

- **주요 파일** — the modules the question is obviously about. Name them by path.
- **혹시 모르는 파일** — everything else in scope: barrels, fixtures, i18n resources, mocks, generated or copied assets, config, scripts, styles. Name the *directories* and require the agent to enumerate what it actually opened.

Require a coverage line per half. An agent that read the main files and skipped the tail must say so rather than reporting a clean result.

Measured 2026-07-29, defects that lived entirely in the tail: a screen replaced but never deleted, three fully authored locale resources with zero consumers, a ternary with identical arms inside a helper, dead selectors for a UI generation that no longer exists. None of these sit in a file anyone would call 주요.

### 8-2. Optimize for recall and citation quality, not precision

A panel that is right 95% of the time makes the operator stop checking, and then the wrong 5% ships carrying the operator's full confidence (`ai-characteristics` AI-14). Uncertainty is what sends the operator back to the source, which is where the real finding happens.

Measured 2026-07-29, both from one audit:
- A finding was **wrong** (`effectiveEntitlement` "ignores a field"). Checking it made the operator read an SoT clause never read before, which the code in fact satisfied. Cost: one grep. Value: a contract now known.
- A finding was **right but understated** ("same model id in two files"). Checking it exposed a silent-downgrade fallback — pay for pro, receive flash, no error — far worse than the reported duplication. A perfect finding would have produced a smaller fix.

This only works while **refutation is cheap**: require `file:line`, the verbatim quote, and a `confidence` field on every finding. Low confidence is welcome when cited. An uncited assertion turns checking into an investigation, and then the operator skims.

The operator's matching duty: **never adopt and never dismiss on an agent's say-so.** Judge each finding against the source. A clean result is valid and valuable, but state its blind spots — a clean result with unstated blind spots reads as "nothing is wrong", which is a stronger claim than was checked.

## 9. ratchet — turn a found shape into a permanent check

When sweep finds a countable shape, encode it in the project's index script so it cannot return for free.

- **Hard-fail only invariants with no legitimate exception** (identical branches, authority from input, duplicate definition of a registered must-agree constant).
- **`readers=0` must not hard-fail.** A legitimately unconsumed export exists when its consumer arrives next slice. It belongs in the committed index, whose **diff** is the signal.
- Exceptions go in an allowlist **with a stated reason** — visible, not hidden.
- **Validate a new check against known answers before trusting it.** Measured: an indexer shipped with 5 defects (missing `export *`, missing `type_identifier`, missing namespace imports, single-pass comment collection, pseudo-classes counted as classes). Four silently produced false positives at scale; one silently produced a false negative on the exact field it was written to catch.
- **Exercise both branches, not only the firing one.** A check that fires correctly on the case you built it for can still be wrong about when to stay silent, and that half is invisible until it cries wolf in front of the user. Measured 2026-07-29: a README guard was tested only on a commit that genuinely lacked a README, so its "README is present, stay quiet" path was never run — and it was broken, matching the path pattern against the whole `M<tab>README.md` line instead of the extracted path. It shipped and produced a false positive on its first live run. Construct the negative case deliberately, in a throwaway fixture if necessary.

## 10. What no mode covers

Runtime-only relationships (string-keyed lookup, dynamic import, reflection) · structural CSS selectors (dead *classes* are visible, dead *structures* are not) · semantic duplication under different names · anything never written down anywhere.

## 11. New lessons

Add measured lessons here with dates, and update the rule count in the header. Reusable protocol → this file. Project-specific binding (paths, allowlists, script location) → that project's docs, by reference.
