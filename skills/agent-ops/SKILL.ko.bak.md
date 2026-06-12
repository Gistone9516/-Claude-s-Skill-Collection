---
name: agent-ops
description: This skill should be used before spawning or delegating to subagents — when fanning out parallel agents, deciding the opus-vs-sonnet division of labor, or writing a delegation prompt. It holds the full procedure that the lean CLAUDE.md "Agent ops" rule points to. Triggers include "delegate", "fan out", "spawn agents", "use subagents", "에이전트 분담", "팬아웃", "위임", and any moment opus is about to hand work to an agent.
---

# Agent ops — opus/sonnet 위임 절차

The core reflex (conserve opus; sonnet = gather/locate/execute/verify, opus = judge/compose/decide/see; writes serial; don't delegate trivial one-offs) lives always-on in `~/.claude/CLAUDE.md`. Load this skill for the detailed procedure right before spawning agents.

## Core strategy — opus is the bottleneck, not the budget
- **목적 = 시간·품질**(비용 아님). sonnet은 사실상 무제한 — 토큰을 아끼지 말고 적극 투입한다. 진짜 제약은 **opus의 시간·주의력**: opus는 워크플로우의 직렬 병목이자 최고가치 판단자다. → 무거운 읽기·탐색은 sonnet으로 내려 opus가 판단·종합에만 집중하게 한다.
- **Minimize opus reading files directly.** Push all reading, exploration, first-pass processing, and exhaustive surveys down to sonnet, so heavy raw text never enters opus's context.
- **Opus-only (non-delegable):** deployment planning / synthesis & final report / ask-back & approval judgment / final decision on risky writes / composing prose / visual (see) judgment. Everything else "read & organize" defaults to sonnet.
- **Split fine, fan out wide.** sonnet 호출의 고정 오버헤드는 신경 쓰지 말 것(무제한·풍부). 잘게 쪼개 많이 병렬로 돌리면 더 빨리 끝나고 opus는 종합만 하면 된다 — 품질에 도움되면 에이전트를 늘린다.

## Required setup when spawning an agent
- **Model = sonnet (no haiku).** Set `model: 'sonnet'`. Never use haiku. Only complex design / subtle judgment / final synthesis stays with opus.
- **Put `think hard` in the prompt** to raise reasoning depth (there is no effort parameter — prompt is the only lever). For reasoning-heavy delegations, escalate to `ultrathink`.
- **Instruct caveman ultra.** Compress output to caveman ultra (→ `caveman` skill, ultra mode). BUT keep technical accuracy and verbatim data (strings, UI copy, numbers, color values, IDs, paths, **causal chains in arguments**) — do not compress those.
- **Omission-ban: 4 strong rules (mandatory).** Sonnet is fast but prone to early-stop / over-summarizing. Bake these into the delegation prompt:
  - ① **Complete-enumeration contract** — "Do not summarize; enumerate every found item exhaustively, and state the total count N." If possible force a schema (structured output) so omissions surface.
  - ② **Verbatim absolute-preserve** — even under compression, keep strings, numbers, paths, IDs, color values as the original (same as the caveman rule, stronger for sonnet).
  - ③ **Coverage self-report** — at the end state "what was searched / what couldn't be seen / if anything was truncated (top-N etc.), what was dropped." No silent truncation.
  - ④ **Self-verify before returning** — just before submitting, recheck "counted number == actual items listed."

## Fan-out workflow
- Agents shine most when fanned out in parallel. When opus decides "I should use agents": **① deployment plan** (how many, each one's scope) → **② parallel activation** → **③ opus synthesizes & final-reports**.
- **3 tiers + caps (경험적 출발점, 신뢰성 내 최대 가용):** **work**(explore/gather/read) ~10 / **verify**(기계검증·pass-fail) ~2 / **lens**(의견·판단 생성 — deepflow 렌즈·buildflow 적대평가). 고정 상한이 아니라 *신뢰성(opus가 날카롭게 종합 가능)을 해치지 않는 선에서 최대* — sonnet 무제한이므로 품질에 도움되면 늘린다. **verify-2는 *기계검증* 전용 상한이며 lens(의견·council)는 여기 포함되지 않는다**(별도 티어).
- **Parallel is read/explore only. Writes are serial.** Multiple agents moving/deleting/editing the same tree concurrently → conflict/corruption. Serialize writes or isolate via worktree. "Survey/investigate" = parallel; "actual cleanup/edits" = serial after plan approval. **Parallel-write pattern**: when writes genuinely must run in parallel, split so each agent owns one folder = one worktree (`isolation: 'worktree'`); shared files (types/config) and the final merge stay with opus.
- **Plan & fan-out only when parallelism pays.** Single one-off lookups and trivial commands: opus does them directly, no plan ("keep simple commands simple" wins).

## Division by task type
Unifying principle: **sonnet = gather / locate / execute / mechanically-verify; opus = judge / compose / decide / see.** The dividing line = "is it verbatim+judgment, or just fetching?"

| Task type | sonnet (delegate) | opus (direct) | Caveat |
|---|---|---|---|
| Human-read writing (자소서/cover letter, 회의록/minutes, papers, reports) | gather raw material, extract source text verbatim, layout | actual composition (remove AI-tells, 음슴체, voice judgment) | because of the verbatim-source rule, assembling the body is safer in opus |
| Document-file editing (hwpx/pptx/docx) | run scripts, run rule-4 validation (XML parse / linesegarray residue / zip test) & report | final risk call "OK to deliver?" | linesegarray omission = corruption, so double-verify |
| Research / info-gathering | search fan-out / fetch / extract (most sonnet-heavy) | synthesis + adversarial verify (2-cap) | deep-research pattern |
| Design (slides/figures/Figma) | scan nodes / export / render | judge aesthetics from the render (subtract, calm) | opus must see the image to judge — aesthetics not delegable |
| Diagnosis / debugging | locate symptoms / collect logs | root-cause reasoning / fix decision | same as code division |
| File cleanup / survey | exhaustive mapping / content diff | cleanup plan / delete decision | writes serial, after approval |

- **Tricky boundary ① verbatim-body trap**: when the user-provided text must not change by a single character (자소서/회의록), making sonnet place it risks paraphrase → **opus places the verbatim source itself**, sonnet only gathers material.
- **Tricky boundary ② "see"-required work**: design aesthetics, render checks, figure/table integrity need **the image inside opus's context** to judge. Don't trust sonnet's "looks fine" → **opus looks at it directly.**

## Code-work division (precise edits = opus, exploration = sonnet)
Precise code work can't run off summaries — code opus will edit must be seen verbatim to handle types, control flow, edge cases. But opus needs the "surgical site," not the whole repo.
- **① sonnet (scout)** — find "which file/function / all call sites / dependencies & data flow", return **`file:line` pointers + a structure map**. **No paraphrasing/summarizing code** (dangerous). If a code snippet is needed, return it verbatim. Bears the whole-repo grep load instead of opus.
- **② opus (precise)** — Read only the files sonnet pointed to, verbatim → design, logic edits, final review are opus-direct.
- **③ sonnet (verify / mechanical)** — after edits run tests/lint/build, report errors verbatim. Repetitive mechanical edits (rename, signature propagation) = sonnet (complete-enumeration + verbatim).
- What's saved is the exploration phase, not the edit phase (opus's tokens to read the relevant files are normal cost — but 8 of 200). Cross-cutting changes inevitably make opus read a lot.
- **Forbidden**: handing logic-bearing edits to sonnet (omission → bug) / letting sonnet hand back summarized code (pointers or verbatim, nothing in between).
- **Implementer completeness** — an agent that *writes* code must, before editing, read its entire assignment (its spec/contract + the existing files in its folder it will touch) with **zero omission**, then report coverage ("read files X/Y/Z, N lines each"). The omission-ban 4 rules above are for scouts; this is the implementer counterpart — skim-then-write is the source of drift.
- **opus owns integration & contracts** — for parallel chunk work, the cross-chunk interfaces, integration, and merge are opus-direct, never delegated to sonnet (the natural extension of scout→precise→verify).

## Block opus burden from bouncing back
- **Verify results return compressed.** A sonnet verify agent returns **"pass/fail + only failures verbatim"** (passes = count only; failures = source, location, reason). Opus reads only the failures and judges.
- **에이전트 실패·수락 게이트.** opus는 팬아웃 결과를 종합하기 전 각 에이전트가 *정상 완료*했는지 확인 — timeout/거부/부분 반환이면 암묵 수락하지 말고 **재투입 / 부분 반영 / 무효화** 중 택일(기준 명시). 침묵 실패를 모른 채 결정하지 않는다.
- **관찰가능성(census vs sample) 필수.** omission-ban ③(coverage self-report)을 *모든* 티어(work·verify·lens)에 의무화 — 반환물이 전수인지 표본인지, 무엇을 못 봤는지, truncate됐는지 명시. opus는 이 메타정보로 신뢰 여부 판단(없으면 = 불완전 간주).
- **Reuse structure maps.** Save the sonnet-built structure map (file:line / signatures / dependencies / data flow) into the project as a `.md` for next-session reuse. But per the canonical-check routine, just before editing, actually Read the target file again to confirm current state.
