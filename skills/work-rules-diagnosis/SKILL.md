---
name: work-rules-diagnosis
description: Diagnosis and code-change discipline - anti-patchwork rules, root-cause method, and what to check before adding or removing anything. Every rule came from a measured repeat failure. Read in full before identifying a bug's cause, before a root-cause analysis, before removing or disabling a feature, before handling inert code, and before starting any implementation or refactor. Triggers - 디버깅, 원인 분석, root cause, 왜 안 되지, 기능 제거, 리팩토링, 삭제, 처방, refactor, implement.
---

# work-rules-diagnosis — diagnosis and change discipline

Rules: DG-1..DG-18 (18). Ordered by what a violation costs.
CLAUDE.md §4 routes here; the rules live only in this file.

## 1. Anti-patchwork — spec before code (user directive 2026-07-28, global)

The user's diagnosis: **"버그 수정-테스트-버그 수정-테스트 같은 굴레에서 도출되는 결과물은 결국 적층형 땜질 스파게티 코드이기 때문이지."** Software-engineering patterns are used here for that reason, not for elegance.

The mechanism: **a patch does not know what it broke.** A decision that lives only inside code is reversed silently by a later patch that still passes every test. Measured: v1's decisions were sound and even commented, but scattered, so nobody could enumerate them, and v2 re-imposed a width cap v1 had deliberately removed.

### DG-1 Behavior rules carry ID, source, rationale, test

Write them as a table in the spec before implementing:

| Element | What breaks without it |
|---|---|
| ID (B-1, D-2 …) | A later patch cannot name what it violates |
| Source (file:line, or user-confirmed date) | The decision gets re-investigated from scratch |
| Rationale (why) | A future session "improves" it and reintroduces the original problem |
| Test (case name) | No way to tell whether the rule is still alive |

Rationale is the load-bearing one (`ai-characteristics` AI-7). "Undo returns to the first question" is meaningless alone; "because stepping back one turn re-calls the API every time" is what stops someone from changing it.

### DG-2 Classify before fixing

| Class | Action |
|---|---|
| Implementation violated a rule | Fix code, add that rule's test |
| The rule was wrong | **Amend the spec first**, then implement |
| The rule was missing | **Add the rule first**, then implement |

"Just fix it" is not an option; skipping the classification is how decisions accumulate in code only.

### DG-3 Prefer impossible over checked

A bad state guarded by checks yields a bug at every path that forgot the check. Make it unrepresentable: two counters that must agree become one counter and a derivation. Measured: merging a stored turn budget and answer count made a shipped bug impossible and cut the termination condition from three branches to two.

### DG-4 Spec precedes substantial change

A change that substantially alters a subsystem gets a spec first (behavior-rule table, contracts, verification table), reviewed before implementation. Measured in one session: a 51-site CSS change without a spec went the wrong way and was reverted; the next slice, specced first, surfaced two long-lived bugs before any code.

### DG-5 Size is a signal, not a rule

Line count decides nothing; single responsibility does. At ~300 lines ask whether it is one responsibility; if yes it may exceed, registered in the size gate's allowlist with a reason. A 564-line design-token file is one system; a 904-line component holding 10 screens is not. The user: "300줄 규칙은 절대 규칙이 아님… 파일 구조 상 효율을 위해 예외를 둬야한다는 건 어쩔 수 없는 일이지."

### DG-6 No stacked patchwork

Design with layer separation (ports and adapters) and explicit contracts, then implement. Before adding a feature, ask whether the structure accepts it naturally; if not, restructure first. State the same standard to delegated agents (user directive 2026-07-20).

## 2. Root-cause diagnosis (user directive 2026-07-06)

**DG-7 No single-axis confirmation bias.** Wrong causes came from committing to one axis and digging only there; measured, one symptom was misdiagnosed four times running, each asserted as the cause and corrected by the user.

- **DG-8** List several candidate causes before prescribing or asserting.
- **DG-9** Rule each in or out with traces, logs or code; until then they are *candidates*.
- **DG-10** Ask the user which hypothesis to dig first; they often see the phenomenon better and supplied the decisive observations.
- **DG-11** Explain the situation as a timeline first; a state-by-time table is what produced agreement on the cause.

Applies to opus and to delegated agents alike.

## 3. Clue-mining depth (user directive 2026-07-08)

**DG-12 Shallow preparation yields shallow results.**

- Recover internal ground truth, not observations: replay the system to extract its internal state and decisions. Logs answer *what*; internal traces answer *why*.
- Mine every axis the system has, with concrete numbers and timestamps, not summaries.
- Contrast successes against failures to find the single discriminator.
- Fan out per item (one log, one agent) for extraction; opus composes the cross-axis timeline.
- Keep digging until the cause narrows to a code-locatable gate. The user's "더 파 / 구체적으로 / 축별로" means it is still shallow.

## 4. Read memory in full before prescribing (measured 2026-07-04)

**DG-13** Read the relevant memory body before a prescription, experiment or design. The index line says a rule exists; the prohibition is only in the body. Measured: an unread body let a forbidden practice repeat for a whole session.

**DG-14** Ask "which recorded failure does this repeat?" before finalizing a prescription. Passing a gate (build, sim, submit) is not performance verification; gates catch structural regressions, and real logs are the ground truth.

**DG-15** Consolidate scattered failure lessons into one catalogue; a lesson living only in a code comment is missed.

## 5. Before changing: why does this exist (measured 2026-07-04)

**DG-16** Before touching code, a signal or a feature, establish what it is holding up. Judge by the principle, not by matching a past example.

- **Adding.** A new signal or field does not work by being set. Grep that a consumer reads it and that the read changes behavior, and land the consumer in the same commit. Measured: a signal shipped across 3 commits doing nothing.
- **DG-17 Removing inert code: classify by git history first** (user directive 2026-07-04). (a) Unfinished, consumer not implemented: wire it. (b) Reverted remains, consumer deliberately deleted in a regression fix: delete, never rebuild, or the regression returns. (c) Speculation that never had a consumer: optional cleanup. Use `git log -S <symbol>` and the commit messages; "no consumer" alone kills (a) or resurrects (b).
- **DG-18 Removing working code: never remove a verified feature on a side effect alone.** Check whether it holds up another front. Measured: a feature blamed for one bottleneck and removed was the verified engine of another; performance collapsed and it was redesigned the same day. If the purpose is alive, condition it; the defect is usually indiscriminate firing.
- **Byte-verifying that a deletion changed nothing: filter nondeterministic log noise first** (timing telemetry, headers, debug lines), or a harmless deletion reads as DIFFERS. Run build, execution and comparison in one call (`work-rules-shell` SH-19).

## 6. How this file changes

A lesson revises the rule it belongs to in one or two lines with its measured date (`ai-characteristics` AI-17); a new rule updates the header count.
