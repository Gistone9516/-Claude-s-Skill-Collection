---
name: ai-characteristics
description: The catalogue of model behaviours that the working rules were designed around - why verification exists, why consensus is a weak signal, why success signals are not verification, why a rule without rationale gets improved away. Each entry names a measured characteristic and lists the rules it generates. Read before writing or changing a rule, before deciding a verification depth, and whenever a rule looks like unnecessary overhead. Triggers - 이 규칙 왜 있나, 규칙 추가, 규칙 완화, 검증 수준 결정, why this rule, AI 특성, 모델 한계.
---

# ai-characteristics — why the rules exist

Rules: AI-1..AI-14 (14).

This file holds **rationale, not procedure.** Every entry is a measured behaviour of the model itself, followed by the rules that exist because of it. Other skills cite `AI-n` instead of re-explaining the reason, so a reason lives in exactly one place.

**Read this before relaxing or deleting a rule.** A rule whose rationale is not visible looks like overhead, and the next session removes it and reproduces the original problem (that is itself AI-11). If a rule seems unnecessary, find its `AI-n` first — if the characteristic still holds, the rule still holds.

## 1. What the model does with truth

### AI-1 It asserts false things with full confidence

Calibration cannot be trusted, so artifacts must be built to make claims checkable rather than relying on the operator's certainty.

Measured: "the contract has no `difficulty` field", stated flatly after reading lines 93-99. It was on line 100.

Generates: `verify-fanout` VF-4 (build for checkability), VF-19 (read whole units, never line windows), VF-20 (grep silence is not absence), CLAUDE.md G-08 (read the file before asserting).

### AI-2 It presents recall as fact

An embedding-sourced claim arrives in the same register as a sourced one. Nothing in the output distinguishes them, so the distinction has to be forced by tagging.

Generates: CLAUDE.md G-09, `agent-ops` AO-16 (`[fact-cited]` means a real source; anything else is `[assumption]` with lowered confidence).

### AI-3 A session sees a part, never the whole, so its defects are locally reasonable and globally wrong

Every edit is correct in the window it was made in. The defect is only visible from outside that window.

Measured in one project, all AI-authored: two counters for one quantity, a tier override reimplemented while the existing one sat out of view, one model id hardcoded in two packages, a screen replaced but never deleted.

Generates: `verify-fanout` VF-5, VF-7 (brief mode runs first and is a standing exception), VF-8 (countable triggers, because a judged threshold gets skipped when busy), CLAUDE.md G-10.

## 2. What the model does with judgement

### AI-4 Same model, same blind spots — consensus is a weak signal

N agents on one model are not N independent judgements. Agreement across them measures shared priors, not truth. The value of a panel is forced framing separation, not statistical diversity.

Generates: `deepflow` DF-1, deepflow §5 (cross-check consensus against evidence and base rates before trusting it), `verify-fanout` VF-21 (the brief pair gets two *different* lenses — 현장 and 주변 — because two agents on one prompt return one answer twice).

### AI-5 It wants to converge, so it downgrades valid critique

Given its own proposal to judge, the model shaves real objections to "not meaningful" because finishing is rewarded. The appetite grows as the round count grows.

Generates: `deepflow` DF-3 (decide by falsifiable dryness — two consecutive rounds of zero new critiques — never by feel), `buildflow` B-mode round caps, and the rule that hitting the cap with real issues open is escalation, not passage.

### AI-6 It fabricates a stand-in when a required input is missing

It does not stop and report the gap. It invents something shaped like the missing input and proceeds, and the output looks complete.

Measured: a consumer agent run co-parallel with its producer manufactured a substitute input, forcing an opus merge.

Generates: `agent-ops` AO-14 (parallel needs true independence; producer to consumer is a pipeline), `buildflow` BF-5.

### AI-7 A rule without rationale gets improved away

The next session reads a bare rule, sees a better-looking alternative, and changes it — reintroducing the problem the rule was written to stop. Rationale is what makes a rule survive contact with a competent future session.

Measured: v1's decisions were sound and even commented in the code, but scattered where nobody could enumerate them, so v2 re-imposed a width cap v1 had deliberately removed.

Generates: `work-rules-diagnosis` DG-1 (ID, source, rationale, test), `verify-fanout` VF-12, and this file.

## 3. What the model does when reporting

### AI-8 Success signals are self-reported, not verified

"N/N complete" is the model's belief about its own run. Files may be missing, in the wrong place, or rubber-stamped by a verification step that did not verify.

Measured 2026-06-24: a workflow reported completion while artifacts were scattered outside the intended paths.

Generates: `work-rules-automation` AU-8 (audit artifacts on disk; opus re-verifies correctness by actually executing), and the division that agents generate while deterministic execution proves.

### AI-9 Subagents write relative to cwd even when handed an absolute path

Measured 2026-06-24, repeatedly. The instruction is accepted and then not followed.

Generates: `work-rules-automation` AU-7, AU-9 (state the fallback and have the agent return the path it actually used).

### AI-10 Relay compresses away the finding

Told to report concisely, the model compresses the thing that mattered along with the noise. The operator then acts on a report that no longer contains the reason to act differently.

Generates: `agent-ops` AO-18 (the `signal` channel, which is compression-resistant), AO-19 (the discoverer upgrades richness; judgement and caveats are never compressed, only enumeration and data).

### AI-11 Instruction adherence degrades as one response grows

The real limit is the total output of a single response. Long prose plus a long tool payload truncates the payload mid-block, and an unclosed block executes nothing and renders as plain text — a silent stop.

Generates: `work-rules-automation` AU-2 (never combine long prose and a long payload; one long payload per response).

### AI-12 Output is hard-capped, and hitting the cap loses the whole run

An agent that exceeds its response cap fails and returns nothing, after doing all the work.

Measured: an agent told to rewrite a 65k-character report died at the cap. The observed number was 32,000 output tokens; it is not restated in the current tool contract, so treat it as a floor and re-check before relying on the exact figure.

Generates: `agent-ops` AO-17 (split by natural unit, write to file, return path and stats only).

## 4. What the model does when searching and checking

### AI-13 It gravitates to the files that look important and skims the rest

An agent told to audit a package reads the modules the question is obviously about. The tail — barrels, fixtures, locale resources, mocks, generated assets, config, styles — is where the defects actually live.

Measured 2026-07-29, defects found only in the tail: a replaced-but-undeleted screen, three fully authored locale resources with zero consumers, a ternary with identical arms, dead selectors for a UI generation that no longer exists.

Generates: `verify-fanout` §8-1 (partition the surface into 주요 파일 and 혹시 모르는 파일, and require a coverage line for each half).

### AI-14 A panel that is usually right stops being checked

Optimizing findings for precision makes the operator trust them, and then the wrong minority ships carrying the operator's full confidence. Uncertainty is what sends the operator back to the source, which is where the real finding happens.

Measured 2026-07-29, from one audit: a **wrong** finding made the operator read an SoT clause never read before, at a cost of one grep; a **right but understated** finding, when checked, exposed a silent-downgrade fallback far worse than what was reported. A perfect finding would have produced a smaller fix.

Generates: `verify-fanout` §8-2 (optimize for recall and citation quality, not precision; require `file:line`, a verbatim quote and a confidence field so refutation stays cheap), and the operator's matching duty never to adopt or dismiss on an agent's say-so.

## 5. Adding an entry

A new entry belongs here when the cause is **the model's behaviour**, not this environment's tooling. A PowerShell or git trap goes to `work-rules-shell`; a document-format trap goes to `work-rules-docs`. The test: would this still happen on a different OS with different tools? If yes, it is an AI characteristic.

Each entry needs the characteristic, the measured evidence with its date, and the rule IDs it generates. Update the count in the header. When a rule elsewhere is added or changed, point it at its `AI-n` rather than restating the reason.
