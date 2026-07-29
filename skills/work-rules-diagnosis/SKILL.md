---
name: work-rules-diagnosis
description: Diagnosis and code-change discipline - anti-patchwork rules, root-cause method, and what to check before adding or removing anything. Every rule came from a measured repeat failure. Read in full before identifying a bug's cause, before a root-cause analysis, before removing or disabling a feature, before handling inert code, and before starting any implementation or refactor. Triggers - 디버깅, 원인 분석, root cause, 왜 안 되지, 기능 제거, 리팩토링, 삭제, 처방, refactor, implement.
---

# work-rules-diagnosis — diagnosis and change discipline

Rules: DG-1..DG-18 (18). Ordered by what a violation costs.
CLAUDE.md §4 routes here; the rules themselves live only in this file.

## 1. Anti-patchwork — spec before code (user directive 2026-07-28, global)

The user's diagnosis, verbatim: **"버그 수정-테스트-버그 수정-테스트 같은 굴레에서 도출되는 결과물은 결국 적층형 땜질 스파게티 코드이기 때문이지."** This is why software-engineering patterns are used here at all — not elegance, but because the patch-test loop provably degrades a system.

The mechanism: **a patch does not know what it broke.** When an earlier decision exists only implicitly inside code, a later patch reverses it silently and still passes every test.

Measured: v1's judgments were sound and even well commented — `theme.css:451-456` states the exact width bug its override fixes; another comment records "어려워요는 답이 아니라 난이도 신호". The failure was that these decisions sat scattered in comments, so **nobody could enumerate them.** Consequence: v2's first web slice re-imposed a width cap v1 had deliberately removed, and a double-counter bug in the narrowing flow shipped in v1 and survived months.

### DG-1 Behavior rules carry ID, source, rationale, test

Write them as a table in the spec before implementing. All four elements are required:

| Element | What breaks without it |
|---|---|
| ID (B-1, D-2 …) | A later patch cannot name what it violates |
| Source (file:line, or user-confirmed date) | The decision gets re-investigated from scratch |
| Rationale (why) | A future session "improves" it and reintroduces the original problem |
| Test (case name) | No way to tell whether the rule is still alive |

Rationale is the load-bearing one (`ai-characteristics` AI-7). "Undo returns to the first question" is meaningless alone; "because stepping back one turn re-calls the API every time and round-trip cost becomes uncontrollable" is what stops someone from changing it.

### DG-2 Classify before fixing

When a bug appears, do not go straight to code. Decide which of three it is:

| Class | Action |
|---|---|
| Implementation violated a rule | Fix code, add that rule's test |
| The rule was wrong | **Amend the spec first**, then implement |
| The rule was missing | **Add the rule first**, then implement |

"Just fix it" is not one of the options. Skipping this classification is exactly how decisions accumulate in code only, which is the definition of 적층형.

### DG-3 Prefer impossible over checked

Allowing a bad state and guarding it with checks yields a bug at every path that forgot the check. Make the state unrepresentable instead. Two counters that must agree become one counter and a derivation — what is not stored cannot drift.

Measured: v1's "어려워요" bug existed because turn budget and answer count were stored separately. Merging them made the bug impossible to reproduce and cut the termination condition from three branches to two.

### DG-4 Spec precedes substantial change

Any change that substantially alters a subsystem gets a spec first — behavior-rule table, contracts (types and signatures), verification table — reviewed before implementation.

Measured both directions in one session: a 51-site CSS change made without a spec went in the wrong direction entirely and was reverted; the next slice, specced first, surfaced two long-lived v1 bugs before a single line of code was written.

### DG-5 Size is a signal, not a rule

Line count decides nothing; single responsibility does. At ~300 lines ask whether it is one responsibility. If yes it may exceed, and gets registered in the size gate's allowlist with a stated reason so the exception is visible rather than hidden. Measured: a 564-line design-token CSS file is one design system (register it); a 904-line component holding 10 screens and 50 state fields is not (split it). User's words: "300줄 규칙은 절대 규칙이 아님… 파일 구조 상 효율을 위해 예외를 둬야한다는 건 어쩔 수 없는 일이지."

### DG-6 No stacked patchwork

Design with layer separation (ports and adapters) and explicit contracts, then implement. Before adding a feature, ask whether the structure accepts this change naturally; if not, restructure first and then add. State the same standard to delegated agents. (user directive 2026-07-20)

## 2. Root-cause diagnosis (user directive 2026-07-06)

**DG-7 No single-axis confirmation bias — list multiple hypotheses first.** The repeated reason for wrong causes is committing to one axis and digging only there. Measured: a game's draw condition was misdiagnosed four times running — economy, then cross-race, then chip, then RC-8 — each asserted as "this is the cause" and each corrected by the user.

- **DG-8** Before prescribing or asserting, list several candidate causes. Do not fixate on one.
- **DG-9** Rule each in or out with traces, logs, or code. Until confirmed, present them as *candidates*, never as the cause.
- **DG-10** Ask the user which hypothesis to dig into first. They often see the phenomenon better — measured: the user supplied the decisive observations ("문앞 정체", "원기옥 분할").
- **DG-11** Explain the situation as a timeline first. A state-by-time table conveys the flow most clearly — measured: the T175 gold → T180 bankruptcy → T197 charge timeline is what produced agreement on the cause.

Applies to opus and to delegated agents alike.

## 3. Clue-mining depth (user directive 2026-07-08)

**DG-12 Shallow preparation yields shallow results.** Mine clues exhaustively before prescribing; preparation depth sets result depth.

- Recover internal ground truth, not observations. Replay the system to extract its internal state and decisions (roles, signals, reservation reasons). Log observations answer *what*; internal traces answer *why*. Measured: only a faithful replay recovering the internal role census and signal timeline explained why units were idle.
- Mine every axis exhaustively — combat, economy, level, resources, position, strategy — with concrete numbers and timestamps for each. No summarizing; write "day150 51턴 n=0".
- Run a win-loss natural experiment: contrast successes against failures to find the single discriminator. Measured: whether `press` fired was what separated wins from losses.
- Fan out per item (one log, one agent) for exhaustive extraction, then opus composes the scenario, grouping clues by type into a cross-axis timeline.
- Keep digging until the root cause narrows to a code-locatable gate inventory. The user's pressure to "더 파 / 구체적으로 / 축별로" is the signal that it is still shallow.

## 4. Read memory in full before prescribing (measured 2026-07-04)

**DG-13** Read the relevant memory in full before a prescription, experiment, or design. A one-line MEMORY.md index entry is not a substitute — the index tells you a rule exists, but the sharp prohibition is only in the body. Measured: the body went unread and a forbidden behavior (judging performance by self-play) repeated for a whole session; the rule was opened only after performance collapsed.

**DG-14** Make "which recorded failure does this repeat?" an explicit step before finalizing a prescription. Check against the whole failure catalogue and related code comments first. Passing a gate (build, sim, submit) is not performance verification — gates catch structural regressions only, and real logs are the ground truth for performance.

**DG-15** Consolidate scattered failure lessons into one catalogue. A lesson that lives only in a code comment is missed by the check — measured.

## 5. Before changing: why does this exist (measured 2026-07-04)

**DG-16** Before touching code, a signal, or a feature, establish what it is holding up. Judge by this principle rather than by matching a past example — example-matching stops firing as soon as the shape changes slightly.

- **Adding.** A new signal or field does not work by being set. Verify with grep that a consumer reads it and changes behavior. A set-but-unread signal passes compilation and every gate and ships as inert. Measured: a signal was set and shipped across 3 commits doing nothing, caught by a reverse lens. Standard: grep the read sites, confirm the read changes behavior, and land the consumer in the same commit. Tell delegated agents the same.
- **DG-17 Removing inert code: classify by git history before deleting or rebuilding** (user directive 2026-07-04). grep tells you only that something does not run. (a) Unfinished, consumer not implemented → wire it. (b) Reverted remains, consumer deliberately deleted in a regression fix → delete, do not rebuild, because rebuilding revives that regression. (c) Genesis speculation, never had a consumer → harmless, optional cleanup. Use `git log -S <symbol>` plus the introducing and deleting commit messages. Cutting on "no consumer" alone kills (a) or resurrects (b) — measured: `foe_deep` was (b), and rebuilding it would have revived a deleted regression.
- **DG-18 Removing working code: do not remove a verified feature on a side effect alone** (measured: `war_want`). When blaming a feature for one front's problem, check whether it holds up another. Measured: it was named as the upkeep bottleneck and removed wholesale, but it was in fact the verified breakthrough engine; performance collapsed 6 → 2 and it was redesigned the same day. If the purpose is still alive, the fix is conditioning, not removal — the real defect is usually indiscriminate firing, not existence.
- **Byte-verifying that a deletion changed no behavior: filter log noise first.** Game logic can be deterministic while logs carry nondeterministic noise: response-time telemetry (`^TIME `), command headers (`COMMAND:`), debug lines (`^#`). Unfiltered, a harmless deletion reads as DIFFERS. Compare with `diff <(grep -avE '^#|COMMAND:|^TIME ' new) <(... old)`, and run build, execution and comparison inside a single WSL call (combines with the `/tmp` trap in `work-rules-shell`).

## 6. New lessons

Add diagnosis and change-discipline lessons here with the measured date, and update the rule count in the header.
