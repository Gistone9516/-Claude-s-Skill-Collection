---
name: agent-ops
description: Delegation policy - the opus/sonnet division, model and effort per stage, when to use Agent versus Workflow, fan-out approval and caps, the Report envelope, and how large or unattended runs are structured. A card here, full policy and rationale in reference/rules.md; the tool descriptions are canonical for mechanics. Read right before spawning agents, fanning out, or writing a delegation prompt. Triggers include "delegate", "fan out", "spawn agents", "use subagents", 에이전트 분담, 팬아웃, 위임.
---

# agent-ops — card

Rules: AO-1..AO-24 (24). Full policy with rationale: `reference/rules.md`. The approval gate itself is CLAUDE.md G-22; why the rules exist is `ai-characteristics`. "opus" is the session's model (G-03).

The card is 11 lines, the decisions taken at every spawn. Report-envelope field lists, task-type tables and code-work steps are opened when writing that kind of prompt (2026-11-21, card size chosen per skill).

1. AO-1: tool descriptions own mechanics; this skill owns policy. Never restate a tool fact.
2. AO-2, AO-5: sonnet reads, explores and drafts; opus plans, synthesizes, decides, writes prose and judges anything visual. Load-bearing judgement is never an `agent()`.
3. AO-4: mechanical stages get `model: 'sonnet'` and low effort; lens and critique get sonnet at default effort; judging inside a loop inherits the session model.
4. AO-6, AO-8: `Agent` for one or two independent lookups, `Workflow` for loops, pipelines and fan-out, and a Workflow only on the user's explicit opt-in.
5. AO-12, AO-13: report the agent count with a per-stage breakdown before fanning out; standing pairs are counted. The cost is reading, so name the files an agent may open.
6. AO-14: writes are serial; parallel is for reading or for disjoint ownership. `workflows/fanout-verified.js` enforces count, ownership and the report schema in code.
7. AO-15: fix the return size at delegation time; a brief pair returns 3-5 lines.
8. AO-16: factual work tags claims `[fact-cited]` with a real source or `[assumption]`.
9. AO-17: split high-output work; each agent writes a file and returns the path.
10. AO-18, AO-19: agents return the Report envelope (ROUTE, STATUS, TLDR, reliability fields, `signal`); obey ROUTE without re-reasoning.
11. AO-24: UI work adds a design pair (대상, 주변); with the brief, three agents, not four.

## Where the rest is

| Situation | Reference section |
|---|---|
| What is canonical where | 1 |
| Division of work, effort per stage | 2-3 |
| Agent versus Workflow, idle model, resuming | 4 |
| Fan-out counts and caps | 5 |
| Writing the delegation prompt, return size, evidence tags | 6 |
| Report envelope fields and read protocol | 7 |
| Division by task type | 8 |
| Code work: scout, edit, verify; UI design pair | 9 |
| Large and unattended runs | 10 |

A lesson revises its rule in `reference/rules.md` in one or two lines with its measured date (AI-17).
