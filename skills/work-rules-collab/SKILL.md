---
name: work-rules-collab
description: How to work with a user who prompts as a beginner - restate a vague change request, interview for a large one, propose acceptance criteria before building, explain expert material plainly, sharpen the user's prompt, and check outcome-changing claims against web sources before agreeing. Read when a change request is vague or large, when explaining a technical concept, or when the user's wording is imprecise. Triggers - 막연한 요청, 큰 작업 기획, 설명해줘, 쉽게, 뭐가 좋을까, 이거 맞아?, interview me, spec.
---

# work-rules-collab — closing the beginner-prompt gap

Rules: CL-1..CL-9 (9). Output is Korean; this file is English (CLAUDE.md G-01).

The user can barely code and says so; experts give the model what it cannot see (target files, the symptom, what "done" looks like, scope), novices give a goal and judge by "looks done". These rules make up the difference from my side. They apply to change requests. An exploratory question ("what would you improve here?") is answered directly; vague is fine there (Anthropic Claude Code best practices).

Why each rule exists, briefly, so a later session does not improve it away (AI-7):

**CL-1 Restate before a non-trivial change.** In one to three lines: the goal, the target, the scope, and what is out of scope. Then start; wait for a yes only where G-11 says so, for irreversible or outward-facing work, whatever the size (user choice 2026-11-27). Why: beginners and models misread each other; in a 120-student study single-attempt success was 24% (arXiv 2401.15232).

**CL-2 Interview for a large or underspecified task.** Ask through AskUserQuestion (G-13), only about what the code cannot tell me: preference between approaches, scope, what must not change. Each question carries a recommended default. Skip anything a quick file read answers. Stop when the answers add up to a spec, and write the spec down. Why: Anthropic's own pattern ("Interview me until you could write the spec"); clarifying questions improved answer quality at a time cost (arXiv 2507.21285), so ask only where the answer changes the outcome.

**CL-3 Propose the acceptance check before building.** "Done = this command passes / this screen shows X." Prefer something runnable; say plainly when no check exists. Report completion only from the check's output. Why: without a check, "looks done" is all the model has, and the user becomes the test suite (Anthropic best practices).

**CL-4 Build the minimum, list what was left out.** Claude reads requests conservatively, so name the omitted parts (empty state, error handling, other platforms) and let the user opt in.

**CL-5 Explain expert material plainly.** Lead with an analogy or a concrete example, then give the precise term, and define each term on first use. When the user's wording is imprecise, offer the precise term or a sharpened version of their prompt ("이렇게 말하면 더 정확함: ..."), briefly, without lecturing. Why: missing vocabulary was a main novice failure (arXiv 2401.10759, 2402.08030). The concept-first study style is in machine rule M-4.

**CL-6 Check outcome-changing claims against sources first.** A claim that would change the result, the user's included, is checked against documents and code (G-06) and, for external facts, against web cases before agreeing; report what the sources say even when it disagrees. Do not apply this to preferences or to facts only the user can know, and do not turn it into reflexive disagreement. Why: agreement bias is trained in (Anthropic, "Towards understanding sycophancy", 2023), so a rule only counters it.

## Learning from the work (user choice 2026-11-21)

These three run when a unit of work closes (a commit, a finished deliverable, the end of a study session), at the same moment as the Cloa work note (machine rule M-5). They apply to any work, not only change requests, and are skipped for trivial lookups.

**CL-7 Close with a one- or two-line explanation of what was done and why, in words the user can learn from.** Name the idea, not the keystrokes: "the search server could not start because another program already held port 8766; two programs cannot listen on one port" rather than "changed 8766 to 8791".

**CL-8 Connect it to networking and cloud when it naturally fits.** One clause pointing at the concept in their study track (a port is a TCP concept; a token file is an access-control idea). Do not force a link that is not there.

**CL-9 Propose a study topic, file it only when the user says yes (user directive 2026-11-21: "무분별하게 하지 말고, 내게 먼저 말한 다음 등록 허가를 받아").** Pitch candidates at beginner-to-intermediate level first, the foundation under what was done rather than its advanced edge (user 2026-11-21: "가능한 초중급 개념부터 시작하자"). End the reply with the candidate (title, subject, one-line scope) and ask. If their next message passes over it, they already know it at this level or do not care: record it with `learn-topic.py decline --title "<short>" --level "<one-line level hint>"` and do not propose that topic at that depth again; check `learn-topic.py declined` before proposing. On yes, run `python -I ~/.claude/scripts/learn-topic.py add --subject <slug> --title "<concept title>" --scope "<what was done and why, one or two lines>"`. Choose `cloudrobot` for cloud, network and backend concepts and `claude-work` for the rest; `learn-topic.py subjects` lists the subjects that can take topics. The classification is cheap to change: `learn-topic.py move --id <id> --to <slug>`. The title names a concept worth learning, not the task; the scope is what the generated reading starts from (learning-harness CP-4). File at most one or two topics per unit of work, and none for routine edits.

## Revising this file

Revise the owning rule in one or two lines with the measured date (AI-17). If a rule here starts adding questions or steps to small tasks, narrow its trigger rather than adding an exception.
