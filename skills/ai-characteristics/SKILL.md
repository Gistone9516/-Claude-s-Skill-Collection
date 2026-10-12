---
name: ai-characteristics
description: The catalogue of model behaviours that the working rules were designed around - why verification exists, why consensus is a weak signal, why success signals are not verification, why a rule without rationale gets improved away. Each entry names a measured characteristic and lists the rules it generates. Read before writing or changing a rule, before deciding a verification depth, and whenever a rule looks like unnecessary overhead. Triggers - 이 규칙 왜 있나, 규칙 추가, 규칙 완화, 검증 수준 결정, why this rule, AI 특성, 모델 한계.
---

# ai-characteristics — why the rules exist

Rules: AI-1..AI-17 (17).

This file holds **rationale, not procedure.** Every entry is a measured behaviour of the model itself, followed by the rules that exist because of it. Other skills cite `AI-n` instead of re-explaining the reason, so a reason lives in one place.

**Read this before relaxing or deleting a rule.** A rule whose rationale is not visible looks like overhead, and the next session removes it and reproduces the original problem (AI-7). If the characteristic still holds, the rule still holds. A rationale that is *measurably false* is worse than none, because the first session to check it deletes the rule with it: correct the reason and keep the rule (measured 2026-09-07, when the brief pair's stated ground "cheap enough to always run" proved false).

## 1. What the model does with truth

### AI-1 It asserts false things with full confidence

Calibration cannot be trusted, so artifacts are built to make claims checkable. Measured: "the contract has no `difficulty` field", stated after reading lines 93-99; it was on line 100.

Generates: `verify-fanout` VF-4, VF-19, VF-20; CLAUDE.md G-08.

### AI-2 It presents recall as fact

An embedding-sourced claim arrives in the same register as a sourced one, so the distinction has to be forced by tagging.

Generates: CLAUDE.md G-09, `agent-ops` AO-16.

### AI-3 A session sees a part, never the whole, so its defects are locally reasonable and globally wrong

Every edit is correct in its own window; the defect is visible only from outside it. Measured in one project: two counters for one quantity, a tier override reimplemented out of view, one model id hardcoded in two packages, a screen replaced but never deleted.

Generates: `verify-fanout` VF-5, VF-7, VF-8; CLAUDE.md G-10.

## 2. What the model does with judgement

### AI-4 Same model, same blind spots — consensus is a weak signal

N agents on one model share priors; their agreement is not N judgements. A panel's value is forced framing separation.

Generates: `deepflow` DF-1 and §5, `verify-fanout` VF-21, `agent-ops` AO-24.

### AI-5 It wants to converge, so it downgrades valid critique

Judging its own proposal, the model shaves real objections to "not meaningful" because finishing is rewarded, more so as rounds grow.

Generates: `deepflow` DF-3 (falsifiable dryness), `buildflow` B-mode round caps; hitting the cap with real issues open is escalation, not passage.

### AI-6 It fabricates a stand-in when a required input is missing

It does not report the gap; it invents something shaped like the input and the output looks complete. Measured: a consumer agent run beside its producer manufactured a substitute input. Measured 2026-09-29 in prose: asked to *emphasize* a view in a 자소서, I wrote it as the user's *motive*.

Generates: `agent-ops` AO-14, `buildflow` BF-5, CLAUDE.md G-29.

### AI-7 A rule without rationale gets improved away

The next session sees a better-looking alternative and reintroduces the problem the rule stopped. Measured: v1's decisions were sound but scattered in comments, so v2 re-imposed a width cap v1 had deliberately removed.

Generates: `work-rules-diagnosis` DG-1, `verify-fanout` VF-12, and this file.

## 3. What the model does when reporting

### AI-8 Success signals are self-reported, not verified

"N/N complete" is the model's belief about its own run. Measured 2026-06-24: a workflow reported completion with artifacts scattered outside the intended paths.

Generates: `work-rules-automation` AU-8; agents generate, deterministic execution proves.

### AI-9 Subagents write relative to cwd even when handed an absolute path

Measured 2026-06-24, repeatedly: the instruction is accepted and not followed.

Generates: `work-rules-automation` AU-7, AU-9.

### AI-10 Relay compresses away the finding

Told to be concise, the model compresses what mattered along with the noise.

Generates: `agent-ops` AO-18 (`signal` channel), AO-19.

### AI-11 Instruction adherence degrades as one response grows

Long prose plus a long tool payload truncates the payload mid-block, and an unclosed block executes nothing: a silent stop.

Generates: `work-rules-automation` AU-2.

### AI-12 Output is hard-capped, and hitting the cap loses the whole run

An agent past its response cap returns nothing after doing the work. Measured: a 65k-character rewrite died at the cap (observed near 32,000 output tokens; not in the current tool contract, so re-check before relying on the figure).

Generates: `agent-ops` AO-17.

## 4. What the model does when searching and checking

### AI-13 It gravitates to the files that look important and skims the rest

The tail (barrels, fixtures, locale resources, mocks, generated assets, config, styles) is where defects live. Measured 2026-07-29: four defects found only there.

Generates: `verify-fanout` §8-1.

### AI-14 A panel that is usually right stops being checked

Precise findings earn trust, and the wrong minority then ships with full confidence; uncertainty is what sends the operator back to the source. Measured 2026-07-29: checking a wrong finding taught a contract, and checking an understated one exposed a far worse defect.

Generates: `verify-fanout` §8-2.

### AI-15 It fills every section to a similar length and pads with 사족 to reach it

Output length per section comes out roughly uniform whatever the substance, and thin sections get padded with restatements and generic filler. Measured 2026-08-02: a 결과보고서 at one density everywhere was rejected ("목표 토큰을 채우려고 사족을 붙이지 마 — 이건 전역 규칙이야").

Generates: a standing directive — **length follows substance; a section with less to say is shorter.** Delegating per section lets each find its own depth.

### AI-16 It substitutes a workaround for the commanded fix, and reports it as the fix

Told to remove a problem, it adds a shim, resolver or compatibility branch that makes the problem survivable. Everything the layer touches is new, so every gate passes and success arrives fast. Measured 2026-08-31: asked to fix Linux incompatibilities, it added a file resolving `python` at runtime and left the Windows-shaped step; the real fix was net smaller (−549/+82). The user: 「기존 시스템에 덧씌우는 형태로 당장의 문제를 해결하려는 의도는 매우 불순해」.

The tell is countable: after the change, is the thing the user named still in the tree?

Generates: a standing directive (2026-08-31) — **on 해결·제거·이식·교체, name the existing thing a literal reading would change before adding anything, and say why it is not changing.** Kept here by the user's choice rather than in CLAUDE.md.

### AI-17 It records every failure by appending, until following the rules is itself the failure

Asked to stop a mistake recurring, it appends case history to the rule file; together the additions become a checklist that output is fitted to. Measured 2026-10-11: `work-rules-writing` ranked below a five-line guide in a blind test. The user: "프롬프트에 남겨놔야 같은 실수를 반복하지 않는다지만, 정도가 과해지는 것 같아."

Generates: every skill's closing rule — revise the owning rule in one or two lines with its measured date; long evidence is cut, not appended (`verify-fanout` VF-16, `work-rules-writing` WR-14).

## 5. Adding an entry

A new entry belongs here when the cause is **the model's behaviour**, not this environment's tooling: would it still happen on a different OS with different tools? Each entry gives the characteristic, the measured evidence with its date in a sentence or two, and the rule IDs it generates. Update the header count, and point other rules at the `AI-n` rather than restating the reason.
