---
name: verify-fanout
description: Evidence grading and the indexing protocol for documents and code - how to write so a later session can check a claim, how to search the index instead of re-reading, and which of four verification modes to run. A card here, full rules in reference/rules.md. Read before editing a module you did not just write, before asserting something exists or does not exist, before finalizing a spec, and before auditing inherited code. Triggers - 검증, 확인, 대조, 감사, 인덱싱, 색인, "정말 없나", "원문 맞나", spec 확정, 이식 검토, 모듈 수정 착수, verify, audit, drift check.
---

# verify-fanout — card

Rules: VF-1..VF-24 (24). Full text with the measured incidents: `reference/rules.md`. CLAUDE.md G-05..G-10 point here.

The card is 10 lines: one per decision that changes what I do next. Writing conventions (IDs, shadow notes, symbol registries) are only needed while writing a spec or document, so they stay in the reference (2026-11-21, card size chosen per skill).

1. VF-1: no canonical source, only grades: execution, code, two independent records, one document, recall. Say the grade when the answer rests on a document or recall.
2. VF-2, VF-3: an AI-written document recording a user decision is still a document; a `(사용자 확정)` label counts only if it points at the record.
3. VF-5: a session's defects are locally reasonable and globally wrong, so look outside the file for the duplicate, the value that must agree and the doc that restates it.
4. VF-8: brief only above the size gate (a file group not yet read, about ten or more files, or three or more independent questions; never for research-only work), at task start, first contact with a new file group, after compaction, or when the user cites a past decision.
5. VF-21, VF-9: the brief is two agents, 현장 and 주변, each told the other half is covered, described `Brief <lens>: ...` so `skill-gate` lets them through, each returning 3-5 imperative lines or "주의할 것 없음".
6. VF-6: pick the mode first (brief, verify, sweep, ratchet). Agents find new shapes; scripts remember known ones; a script with no oracle is not trusted.
7. VF-19: read whole units, never line windows.
8. VF-20: grep finding nothing is not absence. To assert absence, read the unit that would hold it and search the whole document set.
9. VF-23: batch gates at natural boundaries; fire a single-item gate only for something destructive, blocking or plan-changing.
10. VF-15, VF-16: correct a wrong document instead of annotating it, and revise in place instead of writing a second document.

## Where the rest is

| Situation | Reference section |
|---|---|
| Grading evidence, labels | 1 |
| Choosing a mode | 2 |
| Running a brief | 3 |
| Writing a spec or document (IDs, rationale, shadow notes, symbol registry) | 4 |
| Writing code so it can be checked | 5 |
| Searching an unfamiliar package | 6 |
| Verifying claims from a document | 7 |
| Sweeping inherited code | 8 |
| Turning a finding into a permanent check | 9 |

A lesson revises its rule in `reference/rules.md` in one or two lines with its measured date (AI-17).
