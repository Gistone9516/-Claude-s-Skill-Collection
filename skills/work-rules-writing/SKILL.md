---
name: work-rules-writing
description: Rules for Korean human-facing deliverables and for design - writing from the features of exemplars the user chose (study notes and TIL, prose, slides), punctuation restraint, the verbatim rule, slide minimalism, inheriting an existing style, and measuring length with a script. Read in full before writing or designing anything a person reads - 자소서, 회의록, 보고서, 블로그, 논문, 슬라이드, code comments, figures. Triggers - 문서 작성, 글 써줘, 자소서, 회의록, 보고서, 블로그 글, 슬라이드, PPT 문구, 코드 주석 스타일, 디자인, 카피 작성.
---

# work-rules-writing — Korean deliverables and design

Rules: WR-1..WR-17 (17).
The output of everything here is Korean; this file is instruction, so it is English (CLAUDE.md G-01).

## 1. Which language, and where it applies

**WR-1 Language split.** AI-facing text is English: `CLAUDE.md`, memory files, skill bodies, subagent / Workflow / Agent prompts, system prompts and prompt templates in code. Human-facing text is Korean: conversation, reports, docs, SRS / ADR / README, slides, 자소서, UI copy, code comments, commit messages.

- **A prompt being English does not make its output English.** An AI-facing prompt that produces a human deliverable must say so explicitly inside itself. Measured: a v2 operator prompt is English while the report validator enforces Korean section headings (`## 추세`, `## 결론`), so an English report is rejected at save time; the prompt therefore states its output language in its first section.
- **Text that is both.** Prompt text shown to the user for editing — a slash command that pre-fills the input box — is UI copy, so it stays Korean.
- Korean style terms (음슴체, 개조식) are never translated. Translating them loses the distinction they name.

## 2. Prose

**WR-2 Write from the features of writing the user chose, not from rules (user directives 2026-10-11).** This is the whole of the writing guidance; do not grow it into a checklist (WR-14).

The minimum that always holds, because it is about truth rather than style:
- Keep the source's certainty: "여러 글에서 중단됐다고 한다" never becomes "중단됐다".
- Never invent a motive, lesson or point of view (CLAUDE.md G-29). What the user said or accepted in the session is theirs to write.
- Do not use all the material; keep what the piece is about.

The form, by genre ("글 종류마다 달라야지"):
- **Study notes and TIL.** Write like `reference/exemplar-til-approved.md`, the TIL the user picked as best; its feature list is the guidance. How understanding is woven into theory: `reference/exemplar-study-note.md`. Depth follows how much a topic matters, not how long it was discussed. What matters and was worked out with the AI (a mechanism, a comparison, a correction) goes in at the depth it reached ("수준을 더 깊게 파서 적어놓자"); a topic that took long talk or testing but carries little weight gets its core in two sentences at most (user, 2026-10-11). Process trivia such as counts, paths and tool names is dropped.
- **Prose** (blog post, 자소서, narrative report). Reset to the minimum above on 2026-10-11; there is no prose form yet. Write it plainly. When the user hands over a piece of prose they like, save it as `reference/exemplar-prose-<n>.md`, draw its features out with them as was done for the TIL, and write from those pieces' nuance ("중요한건 규칙이 아닌 늬앙스").
- **Slides.** WR-6..WR-8.

Describe and judge a draft by these features, never by listing rule violations; the user is the judge ("규칙 위반 건을 명확히 집어서 이야기하면 안돼. 서술 형식에서 특징을 명확히 따와야지." and "너는 규칙 중심이야. 유도리가 부족해.").

Why. In blind rounds on 2026-10-11, every rule set read stiff, and each revision drawn from critique shifted the stiffness rather than removing it. What the user wanted was shown by the TIL they picked, and its features were drawn out with them. Prose built from rules kept failing the same way, so it starts over from exemplars: "규칙 중심으로 가니, 문제가 너무 많아짐." Never add "use all the notes", a fixed per-paragraph formula, "add natural connectives", "professional and polished", "always end with a lesson", or numeric style targets (`reference/korean-prose-baselines.md` is evidence, not a target).

**WR-3 Punctuation restraint (user directive 2026-06-12).** The em dash, middle dot, colon and semicolon appeared 0 times in 10,682자 of measured human Korean prose (`reference/korean-prose-baselines.md`), so they read as machine-written. Join clauses with particles (및, 와, 과) and commas; use parentheses for a real aside. A middle dot is allowed only in a short list of same-rank nouns, at most once per line.

**WR-4 Code comments follow the same rule, more strictly (user directive 2026-06-13).** In human-style code, symbols are banned outright in comments — `→`, `—`, `·`, `↔`, `※`, `★`. People do not bother typing symbols; they write sentences. An arrow becomes 다음 / 순으로 / 이면, an em dash becomes a comma or a period, a middle dot becomes a comma or 와/과. Symbols inside UI-rendered strings are product copy and are exempt (a missing-value `—`, a separator `·`).

**WR-5 Text supplied by a person is verbatim — never reworded, summarized or paraphrased.** Narrative text written by a colleague or the user is used exactly as given: no summarizing, no paraphrase, no changed verb endings, no word substitution. Changing agreed wording is damage. Only line-break positions may be adjusted for layout. Do not blend my draft into the supplied original — mark my parts as my draft. If it is unclear, confirm with AskUserQuestion before producing output.

## 3. Slides

These three apply to slides only. Prose and study notes take their form from WR-2.

**WR-6 Presentation slides are minimalist.** Never write complete sentences — key words and numbers only, because the presenter says the rest and a slide of full sentences is dull.

**WR-7 Style is 개조식 음슴체** (telegraphic; noun-form, ~ㅁ, ~함 endings). "~입니다 / ~한다" are forbidden.

**WR-8 The card pattern** is a subheading (noun phrase) plus two or three short fragments. No hanja (必 → 필요). Abbreviations and numbers are fine. Write at length only when supporting evidence is explicitly requested, and even then in 음슴체.

## 4. Method

**WR-9 Analyze the existing style first, then inherit it.** Before making any deliverable — slides, document, figure — study the tone and style of the existing ones in detail and continue them. Making something blind misses the target.

**WR-10 Preserve originals and data integrity.** Work on a new file or a backup and leave the original untouched. When redesigning a figure or table, keep the content and numbers exactly as they are and change only the design; departures from the original all get flagged. Render the result and check it visually before moving on, iterating in small steps.

**WR-11 Show visual results with Playwright screenshots, not file attachments** (CLAUDE.md G-25). `SendUserFile` errors on the user's remote setup and they see nothing, while screenshot tool results render. Reading the screenshot back myself is still required for a seeing-judgment; the user seeing it is a separate, additional purpose. The Playwright MCP only writes under the working directory: a scratchpad `filename` is refused as outside allowed roots (measured 2026-09-15), so save to `.playwright-mcp/` and check that folder is gitignored before committing. Measured 2026-10-11, three times: a screenshot taken right after navigating came out blank (wait for `document.fonts.status` or a short delay first), and reading the PNG right after the screenshot call failed with "file does not exist" because it was not yet written (read it again).

**WR-12 Never estimate length by eye — measure it with a script first (user directive 2026-07-23).** Measured failure: three seed stories were estimated by eye and were off by -22%, -16% and **-40%** (an estimate of 3,800 characters against an actual 2,281), and a cost estimate had been layered on top of the wrong numbers. It surfaced only when the user counted 392 characters themselves.

- **The reference metric is 전체 — every character including spaces and newlines.** Korean paragraphs are short and newlines frequent, especially in web fiction, so excluding newlines diverges from the actual reading burden. Several counting conventions exist, so agree with the user on which one first.
- Have the script emit several metrics at once (전체, 줄바꿈제외, 공백제외, 한글음절, 어절, 문단) to make that agreement easy.
- **The Korean console is cp949**, so printing a Korean filename or body to stdout corrupts it. Write results as UTF-8 JSON and read them with the Read tool; keep stdout to one ASCII line.
- **When a pipeline handles length, do not have the model count.** Models get character counts wrong. Code counts and inserts the number.

## 5. Design

**WR-13 Subtract, and stay calm.** The user dislikes dense, cluttered information: strip to essentials. Colour is a muted, brightness-adjusted chromatic — neither pastel nor achromatic, and not either extreme. Form is rounded and soft.

## 6. Deliverables and this file

**WR-15 Verification status stays out of the deliverable (user directive 2026-08-09).** Evidence grades, bracketed source caveats and my own open questions — "미검증", "측정해야 함", "확인할 것" — go in the message to the user, never into the body of the thing a person reads. G-05 and G-07 govern what I must know and must say; they do not license annotating the artifact. And match verification depth to the stakes: a hackathon pitch is not a legal filing. Measured 2026-08-09 — the user said "기획이 합리적이되 반드시 모든 부분이 객관적이지 않아도 됨. 약간의 망상 가능", and the diagnosis was that what burdened the deck was the homework list outside the slides, not the slides. Loosening the prose instead is the overcorrection that followed, and it was rejected too ("너무 캐주얼 해졌는데.. 대체 너는 어떤 기준인거야?"). Depth changes are said in chat; the artifact just reads clean.

**WR-16 A narrative deliverable is written for the reader's decision, not as my audit trail (user directive 2026-09-09).** A 계획서, 자소서 or 지원서 is read by one person deciding one thing. Settle that before any style question and let style rules bend: "서술 중심의 문서는 규칙을 완벽히 준수하지 않아도 괜찮아." My verification log goes to a working file. What verification produced (dates, counts, first-party sources) stays in, because to the reader it is evidence; deleting it with the caveats left six answers 20% under their floor. A style metric that passes while the reader would not want the sentence is not a pass: a 중소벤처기업부 application met every metric and was still written as my own log. Code, specs and design documents keep strict compliance; there the rule is the contract.

**WR-17 Measured prose baselines live in `reference/korean-prose-baselines.md`.** They are evidence for WR-3 and for preferring real specifics. Do not load them for drafting and never revise toward them; chasing them is how the 2026-09-09 application went wrong.

**WR-14 How a lesson enters this file (user directive 2026-10-11).** When a writing failure recurs, rewrite the rule it belongs to in one or two lines rather than appending a paragraph. Keep the measured evidence short and move long data to `reference/`. Judge a change with two or three samples per condition; one sample cannot separate a rule's effect from run-to-run variance (2026-10-11). Update the count in the header. The user's words: "문단 더 붙이기 방식은 적당히 운용해야 할 것 같아. 프롬프트에 남겨놔야 같은 실수를 반복하지 않는다지만, 정도가 과해지는 것 같아." This file once grew by appended cases until following it was itself the cause of stiff prose (`ai-characteristics` AI-17). Per-deliverable detail (verb-ending conventions and the like) goes in that project's memory.
