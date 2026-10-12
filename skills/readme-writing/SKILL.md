---
name: readme-writing
description: How to write a repository README - a portfolio project repo read first by a recruiter or developer, a working repo re-read by its owner and AI agents, and a sub-folder README that serves as an AI index - built from the koready exemplar the user chose, with GitHub's rendered HTML (details toggles, centered rows, theme images) used to keep the first screen clean. Read in full before writing, restructuring or reviewing any README.md. Triggers - README 작성, README 정리, 리드미, 저장소 소개, 포트폴리오 저장소, 프로젝트 소개 문서, 하위 폴더 README, 구조도.
---

# readme-writing — repository READMEs

Rules: RD-1..RD-9 (9).
The README is Korean (`work-rules-writing` WR-1); this file is instruction, so it is English (CLAUDE.md G-01). When to update a README is `work-rules-shell` SH-23; what goes in it is here.

**RD-1 The reader decides the form (user 2026-10-12).** Name the reader before writing.

| Kind | Reader | Form |
|---|---|---|
| Portfolio project repo | a recruiter or developer opening it first | RD-3 |
| Working repo (config, tools, this blog) | the owner later, and AI agents | RD-4 |
| Sub-folder README | AI agents locating a responsibility | RD-6 |

A repo can be both of the first two; then RD-3 is the shape and RD-4's contents go in folds. A GitHub profile README is out of scope for now ("프로필은 당장 만들지 않을 것", 2026-10-12).

**RD-2 Write from the exemplar's features, not from a checklist.** The user picked koready-backend as the base and asked to absorb compatible strengths from other repos: `reference/exemplar-koready.md` holds its outline, features and the absorbed patterns, and is the guidance. Section names and count follow the project; a section with nothing true to say is left out rather than filled (AI-15). The truth minimum of `work-rules-writing` WR-2 holds: keep a source's certainty, never invent a motive or a lesson (G-29). In 담당 역할 and in a decision's "why", what the user did not say or accept is asked, not written.

**RD-3 Portfolio repo: first screen, then problems, then the rest.** Before any heading: name, one sentence on who it is for and what it does, a centered screenshot row, a link row, and a scope paragraph. Then 담당 역할 → 구조 (one diagram plus the choice and what it cost) → 주요 문제 해결 → 검증 결과 → 기술 스택 → 주요 기능 → 실행과 문서 → 상태. Each 문제 해결 item keeps koready's three beats: why it is a problem, **주요 변경 사항** as noun-ending bullets, one result sentence. Technical depth (alternatives weighed, measurements, before/after, code) goes in a fold under that item (RD-5), which is where "기술적인 면이 더 추가되어도 어색하지 않을" room comes from.

**RD-4 Working repo: the SH-23 five, in reading order.** Identity in one or two sentences, structure map, design core (decisions with their reasons, since a decision without a rationale gets improved away, AI-7), how to run, current state. These stay visible, because this reader came to find them. `~/.claude/README.md` is a local instance of this shape.

**RD-5 Fold depth, never the point.** Fold: the technical depth of an item, large secondary diagrams (ERD, past architecture), the structure map in a portfolio repo, long option tables, per-OS variants, long logs. Never fold: identity, 담당 역할, the run commands, current state, or a problem's visible summary. Folding has a cost: browser find-in-page may not reach folded text. Large repos mostly split long material into `docs/` and sub-folder READMEs instead of folding (in a 2026-10-12 sample of 9, only 2 used `<details>`): when a fold would run past about a screen, move it to a file and link it.
- The `<summary>` names what is inside ("검토한 대안 · 부하 테스트 결과 · 관련 코드"), not "자세히" or "펼쳐서 보기", and carries no emoji or arrow.
- A blank line after `</summary>` and before `</details>`, or the markdown inside renders raw (measured, RD-8).

**RD-6 The AI index lives in the structure map and in sub-folder READMEs.** `verify-fanout` reads "package README structure map" to find where a responsibility lives, and an AI reads the markdown source, so a folded map hides nothing from it while keeping the human first screen clean. Portfolio repo: the map goes in a fold inside 실행과 문서. Working repo: visible. When the map outgrows a fold, `docs/STRUCTURE.md` or per-folder READMEs. A sub-folder README is for that index only: what the folder is responsible for in one line, a file-to-responsibility table, the entry points, and the spec or rule IDs that govern it. No screenshots, no pitch. Keep the map true: a folder added or removed changes the map in the same commit (the SH-23 hook checks only that some README was touched).

**RD-7 Evidence a reader can click.** A test count, coverage figure or deployment claim names the commit it was measured at and links the run, as koready's 검증 결과 does. Numbers come from execution, not recall (G-05). Never present an unmerged feature as done or round a number up; the koready rewrite issue (#382) listed both as out of scope. Verification caveats belong in the message to the user, not in the README (WR-15).

**RD-8 What GitHub renders (measured 2026-10-12 through `gh api markdown`, mode gfm).** Kept: `<details>`, `<summary>`, `open`, `align` on `p`/`div`, `img` `width`, `<picture>` with `prefers-color-scheme` sources, `> [!NOTE]` alerts, `<kbd>`, `<sub>`, mermaid code blocks. Stripped: `style`, `class`; `id` is rewritten to `user-content-<id>`. **`<iframe>`, `<script>` and `<style>` are not removed but escaped, so they appear as literal text on the page.** Center with `align`, never CSS. Use alerts only where the reader would otherwise fail (GitHub's own guidance). After writing HTML into a README, render it the same way before claiming it works: write `{"text": ..., "mode": "gfm"}` to a JSON file from Python (SH-1) and pass it with `gh api markdown --input <file>`.

**RD-9 Report, and how this file changes.** Say whether a README was created or updated and which kind it is (SH-23 asks for the report). A lesson enters as a one- or two-line revision of the rule it belongs to, with long evidence in `reference/` (AI-17, WR-14). A README the user later picks as better than koready becomes a second exemplar in `reference/`, with its features drawn out with the user.
