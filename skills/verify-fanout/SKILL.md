---
name: verify-fanout
description: Evidence grading and the indexing protocol for documents and code - how to write so a later session can check a claim, how to search the index instead of re-reading, and which of four verification modes to run. Read before editing a module you did not just write, before asserting something exists or does not exist, before finalizing a spec, and before auditing inherited code. Triggers - 검증, 확인, 대조, 감사, 인덱싱, 색인, "정말 없나", "원문 맞나", spec 확정, 이식 검토, 모듈 수정 착수, verify, audit, drift check.
---

# verify-fanout — grade the evidence, index it, verify cheaply

Rules: VF-1..VF-24 (24). Sections are ordered by how much a violation costs.
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

**VF-2 A document is not canonical.** A document recording a user instruction is still a document an AI wrote. Measured: an AI-written code comment ("디자인 변경 금지") was lifted into a spec, acquired a `(사용자 확정)` tag, and was quoted back to the user as their own decision; they had given no such instruction.

**VF-3 A label is not a source.** `(사용자 확정)` and equivalents are valid only when they point at a decision record: a question-table row, a memory entry, a quoted message. Nothing to point at means unverified, and the report says so.

**VF-4 A session asserts false things with full confidence** (`ai-characteristics` AI-1), so artifacts are built to make claims checkable rather than relying on the operator's certainty.

**VF-5 The signature of a session's defects is: locally reasonable, globally wrong** (AI-3). Measured in one project, all AI-authored:

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
| **brief** | at the countable triggers of VF-8 | low | a pair, one agent per lens (VF-21), reading the index |
| **verify** | before asserting provenance; before finalizing a spec | low | script first, agent for leftovers |
| **sweep** | inherited or ported code; periodically | high | agent, free lens |
| **ratchet** | after sweep finds a mechanizable shape | one-off | script |

Running the wrong mode returns nothing and costs the budget anyway.

**VF-6 Agents discover new defect shapes; scripts remember known ones.** For code the agent leads and the script ratchets afterward. **A script with no oracle cannot be trusted:** measured, an audit found 9 defects, a script written from it reproduced 4, and the script itself had 5 bugs visible only because the audit had produced ground truth first.

**VF-23 Gates batch by default; a single-item gate has to earn itself (user directive 2026-09-07:** "단건 게이트가 오버헤드와 추론 토큰을 너무 많이 먹고있어"**).** A gate's cost is paid per firing, and the operator pays again to read each return (`agent-ops` AO-13).

- Collect items as they arise and fire once at the natural boundary: end of the file group, end of the task, before the deliverable goes out. §7's 5-8 claims per agent is the default shape.
- Fire a single-item gate only when the item is destructive or irreversible, blocks everything after it, or a wrong answer changes what is done next. Name which, in one clause.
- A parked gate is not a skipped gate. Write it where it will be seen at the boundary and report what was batched (AI-8).

## 3. brief mode — runs first, always

**VF-7 Standing exception (user directive 2026-07-29).** The brief pair is exempt from fan-out pre-approval, from any "spawn agents only when asked" restriction, and from ordering behind the rest of the preamble. Do not ask for it. **Do count it** in the reported total (`agent-ops` AO-12): what it is exempt from is permission, not arithmetic.

It runs unconditionally because a judged threshold is skipped exactly when the session is busiest (`work-rules-automation` AU-22), not because it is cheap. It is not: measured 2026-09-07, it was the second most expensive role in the install. What is weighed against the price is a plan built on a wrong premise and every commit that follows it.

**VF-8 The triggers are countable, not a judgement (user directive 2026-07-30).** A threshold that must be judged is what gets skipped when busy. Run the pair at these four moments:

1. **Task start**, before reading the code and *before proposing a plan*. This is the one that pays: measured 2026-07-30, a brief here overturned 4 of 7 assumptions in a plan already written into a commit message.
2. **First contact with a new file group** — a package, directory or document set this task has not touched. `scripts/brief-nudge.sh` marks this moment at the edit itself, once per file.
3. **Resuming after a compaction.** A summary carries conclusions, not the constraints that produced them.
4. **When the user states a past decision from recall** (CLAUDE.md G-06). Check the documents and the code before agreeing.

Skip it, and say so, for a file created this turn, for a change that closes inside one file already read whole, and for a file group already briefed in this task. **Scale it to the target (user 2026-10-12):** when the target is a small set a script can census (counts, rule ids, cross-references), run the script instead of the pair and say so; the pair is for what a script cannot see, such as a rule restated in other words or a premise that is wrong. Measured 2026-10-12: half of one pair's findings were a single grep. Scope is every task, not only code ("어떤 작업에서나 선행하여 정확도를 올릴 것", 2026-07-29).

**VF-21 The brief is a pair, one agent per lens (user directive 2026-07-30:** "최소 2대를 운영해야 에이전트를 사용하는 의미가 있다"**).** Two agents on the same prompt return one answer twice (AI-4); the second pays only when its framing differs. The two lenses map onto VF-5:

| Lens | Its question | What it catches |
|---|---|---|
| **현장 the site** | What do the files I am about to touch actually say, and which of my assumptions about them are wrong? | *locally* wrong: a stale premise, a signature not as remembered |
| **주변 the surroundings** | What outside my target already does this job, must agree with it, or goes stale once I change it? | *globally* wrong: a duplicate implementation, a constant that must match, a document restating the rule being edited |

Give each lens its half **and tell it the other half is covered**; an agent that believes it is alone surveys everything, and both return the same survey. Both go in one message so they run concurrently. Model tier is §8's; "lens" names the framing only, not AO-18's lens payload. Measured 2026-07-30 on the first run: neither lens returned anything the other did.

Give the pair the relation index and the target path. Each returns **3-5 decision-shaped lines, not a relationship dump**:

```
이 모듈을 고치기 전에
1. tier 판정은 AuthService.resolveTier에 이미 있다. 새로 만들지 말 것
2. turns_left는 answers에서 파생 가능하다. 저장하면 이중 카운터가 된다
3. 이 상수는 providers/deepseek/client.ts와 같아야 한다
```

**VF-9 Either lens must be able to answer "주의할 것 없음".** An agent required to find something produces noise, noise gets skimmed, and a skimmed brief is an unrun brief. The second lens is the one under pressure to justify itself.

**VF-10 Shape is imperative** — do not build this / it already lives here / this must agree with that. Each reads the **index**, not the repository, which is what keeps a pair affordable. Measured: the reimplemented tier override, the duplicated model ids and the stored `turns_left` would each have been prevented by one brief pass.

## 4. Write so it can be searched — documents

- **VF-11 Every normative statement carries an ID** (`B-1`, `D-2`). A rule with no ID cannot be cited, so a later patch reverses it silently.
- **VF-12 Every ID carries source, rationale, test** (`work-rules-diagnosis` DG-1). Rationale is load-bearing (AI-7).
- **VF-13 The header states ID ranges and counts** (`규칙: B-1~B-16 (16건)`). A gate greps and compares, so a rule added without updating the header fails the count.
- **VF-14 Normative and narrative sections are separated**, so a reader can skip narrative without losing a rule.
- **VF-15 Correct a wrong document; do not annotate it (user directive 2026-07-29).** Write what is true now: no "개정 사유", no "원래는 X였으나", no dated correction notes. Git holds history. A *rule's* rationale stays, because it stops a future session from reverting the rule; a *document's* change history goes.
- **VF-16 Do not create a new document for repeated work — revise in place.** Two documents stating the same rule is the document-layer form of two counters. A protocol lives in one file; others reference it.

- **VF-24 A document set whose proper nouns keep drifting gets a symbol registry: one table, no enforcement script (user directive 2026-09-23).** Reach for it when the symptoms appear: one entity spelled several ways, one term counting two things, a dropped setting quietly returning, load-bearing nouns defined nowhere. Measured on a 16-document worldbuilding set: one faction had three spellings and "회차" counted two different things.
  - **Shape:** one markdown table as the single source (VF-16). Per row: ID, canonical spelling, English, known variants, status (canonical / retired / conflicted / undefined), where defined. Definition sites get an anchor comment; **prose keeps the plain word**, because inline IDs make a design document stop being read. IDs go only where a machine already reads (data contracts, tables, asset fields).
  - **No checker by default:** a linter over a solo creative project is a gate that fires on prose. For a set several people write to, enforce only one rule: a retired symbol reappearing.

- **VF-22 A decision gets a note at `_shadow/<same relative path>.md` (user directive 2026-07-30).** Specs and commits are addressed by slice; nothing tells a session which decisions govern **the file it is about to edit**. Mirror the repo tree under `_shadow/`, written as part of the work by the main model, not an agent, holding only what the source cannot.
  - Per decision: **what breaks if a later session does the obvious thing instead** (the load-bearing field, AI-7) · a grade on every claim (VF-1) · a number only beside a repo-committed command that reproduces it · lists pointed at, never copied · when the note goes stale.
  - And what no commit holds, **what that session knew**: read whole / not read / **did a brief run, and did it change the plan** / knowingly deferred. If it cannot be recovered, say so; inventing it is AI-6. Measured 2026-07-30 over three cold reads: the brief sub-field is what separated reconstructible decisions from thin ones.

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
| Where does responsibility X live? | package README structure map (`readme-writing` RD-6) |
| What rules govern this area? | spec's ID table (the header count says whether it is current) |
| **What decisions govern this exact file, and what did they cost?** | its `_shadow/` note (VF-22) |
| Was this promised somewhere? | doc markers (`[개정]`, `[신규]`, `[v1 원문]`) |
| Does this exist at all? | not answerable by search — see VF-19, VF-20 |

Order for an unfamiliar package: **index → barrel → README map → only then the modules the question touches.**

**VF-19 Read whole units, never line windows.** An interface from `{` to `}`; a section to the next header. Measured: `offset 93, limit 7` concluded a field was absent when it was on line 100.

**VF-20 grep returning nothing is not proof of absence.** It is "not found by this pattern". To assert absence, read the whole unit that would contain it and search the whole document *set*. Measured: grepping only the SoT reported a revision as unimplemented when a sibling spec recorded it as a deliberate deferral.

## 7. verify mode — claims from documents

1. **Extract claims from the document's own markers**, never from memory. What is not recalled is exactly what stays unchecked.
2. Turn each into a closed question: "Does X exist at file:line? yes/no + one quoted line."
3. **Script first** — if grep or a count answers it, spend no agent.
4. Batch leftovers 5-8 per agent, `model:'sonnet'`, schema `{claim_id, verdict, citation}`, no prose, **default to REFUTED when uncertain**.
5. Read only REFUTED and UNVERIFIABLE. Confirmed claims are a count.

## 8. sweep mode — new defect shapes in code

Free lenses, one agent per lens, read-only. Lenses that paid off: symbol with no consumer, one quantity two fields, one decision two implementations, authority from input, branch that cannot fire, platform assumption surviving a port, doc promise absent from code.

**Model tier is `agent-ops` AO-4's.** Do not promote findings agents to the session model here; a 2026-07-29 clause doing so was rolled back at the user's correction. **Agents gather and propose, opus judges and decides:** adopting or rejecting a finding, classifying a bug, deciding scope and calling convergence are opus's own work.

### 8-1. Partition the search surface (user directive 2026-07-29)

An agent told to "audit this package" reads the files that look important and skims the rest (AI-13), where things hide. Partition the surface and demand coverage of both halves:

- **주요 파일** — the modules the question is obviously about. Name them by path.
- **혹시 모르는 파일** — everything else in scope: barrels, fixtures, i18n resources, mocks, generated or copied assets, config, scripts, styles. Name the directories and require the agent to enumerate what it actually opened.

Require a coverage line per half; an agent that skipped the tail says so rather than reporting clean.

### 8-2. Optimize for recall and citation quality, not precision

A panel that is right 95% of the time makes the operator stop checking, and the wrong 5% ships with full confidence (AI-14). This works only while **refutation is cheap**: require `file:line`, the verbatim quote and a `confidence` field on every finding. Low confidence is welcome when cited.

The operator's matching duty: **never adopt and never dismiss on an agent's say-so.** Judge each finding against the source. A clean result is valid, but state its blind spots; unstated, it reads as "nothing is wrong", a stronger claim than was checked.

## 9. ratchet — turn a found shape into a permanent check

When sweep finds a countable shape, encode it in the project's index script so it cannot return for free.

- **Hard-fail only invariants with no legitimate exception** (identical branches, authority from input, duplicate definition of a registered must-agree constant).
- **`readers=0` must not hard-fail.** A legitimately unconsumed export exists when its consumer arrives next slice; it belongs in the committed index, whose **diff** is the signal.
- Exceptions go in an allowlist **with a stated reason**.
- **Validate a new check against known answers before trusting it.** Measured: an indexer shipped with 5 defects, four producing silent false positives and one a false negative on the field it was written to catch.
- **Exercise both branches, not only the firing one.** Measured 2026-07-29: a README guard tested only on a commit lacking a README had a broken "stay quiet" path and fired falsely on its first live run. Build the negative case deliberately.

## 10. What no mode covers

Runtime-only relationships (string-keyed lookup, dynamic import, reflection) · structural CSS selectors (dead *classes* are visible, dead *structures* are not) · semantic duplication under different names · anything never written down anywhere.

## 11. How this file changes

A lesson revises the rule it belongs to in one or two lines, with its measured date (AI-17); a new rule only when no existing one owns it, with the header count updated. Project-specific binding (paths, allowlists, script location) goes to that project's docs, by reference.
