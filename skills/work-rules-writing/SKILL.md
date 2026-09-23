---
name: work-rules-writing
description: Rules for Korean human-facing deliverables and for design - removing AI tells, punctuation restraint, the verbatim rule, slide minimalism, inheriting an existing style, and measuring length with a script. Read in full before writing or designing anything a person reads - 자소서, 회의록, 보고서, 논문, 슬라이드, code comments, figures. Triggers - 문서 작성, 자소서, 회의록, 보고서, 슬라이드, PPT 문구, 코드 주석 스타일, 디자인, 카피 작성.
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

**WR-2 No AI tells.** Anything a person reads (자소서, 회의록, 논문, 보고서) must not read as machine-written. Avoid piled-up jargon and buzzwords, parenthetical hanja, and heavy modifiers. Write naturally, centred on actual experience and content. Per-deliverable format and verb ending live in that project's memory.

**WR-3 Punctuation restraint — the em dash and the middle dot are AI detection signals (user directive 2026-06-12).**

- Allowed but sparing: the middle dot only for short lists of same-rank nouns (the official-document standard); the em dash only for a genuine aside, such as a figure-caption subtitle, and rarely.
- Forbidden: mechanical "label — name" repetition (use parentheses or a space), and a middle dot standing in for a conjunction inside prose (use 및 / 와 / 과).
- Preference order: particle (및/와/과) > comma > parentheses > breaking into levels > dash or middle dot. At most one middle-dot list per line; five or more items go to commas or a sub-level.

**WR-4 Code comments follow the same rule, more strictly (user directive 2026-06-13).** In human-style code, symbols are banned outright in comments — `→`, `—`, `·`, `↔`, `※`, `★`. People do not bother typing symbols; they write sentences. An arrow becomes 다음 / 순으로 / 이면, an em dash becomes a comma or a period, a middle dot becomes a comma or 와/과. Symbols inside UI-rendered strings are product copy and are exempt (a missing-value `—`, a separator `·`).

**WR-5 Text supplied by a person is verbatim — never reworded, summarized or paraphrased.** Narrative text written by a colleague or the user is used exactly as given: no summarizing, no paraphrase, no changed verb endings, no word substitution. Changing agreed wording is damage. Only line-break positions may be adjusted for layout. Do not blend my draft into the supplied original — mark my parts as my draft. If it is unclear, confirm with AskUserQuestion before producing output.

## 3. Slides

**WR-6 Presentation slides are minimalist.** Never write complete sentences — key words and numbers only, because the presenter says the rest and a slide of full sentences is dull.

**WR-7 Style is 개조식 음슴체** (telegraphic; noun-form, ~ㅁ, ~함 endings). "~입니다 / ~한다" are forbidden.

**WR-8 The card pattern** is a subheading (noun phrase) plus two or three short fragments. No hanja (必 → 필요). Abbreviations and numbers are fine. Write at length only when supporting evidence is explicitly requested, and even then in 음슴체.

## 4. Method

**WR-9 Analyze the existing style first, then inherit it.** Before making any deliverable — slides, document, figure — study the tone and style of the existing ones in detail and continue them. Making something blind misses the target.

**WR-10 Preserve originals and data integrity.** Work on a new file or a backup and leave the original untouched. When redesigning a figure or table, keep the content and numbers exactly as they are and change only the design; departures from the original all get flagged. Render the result and check it visually before moving on, iterating in small steps.

**WR-11 Show visual results with Playwright screenshots, not file attachments** (CLAUDE.md G-25). `SendUserFile` errors on the user's remote setup and they see nothing, while screenshot tool results render. Reading the screenshot back myself is still required for a seeing-judgment; the user seeing it is a separate, additional purpose. The Playwright MCP only writes under the working directory: a scratchpad `filename` is refused as outside allowed roots (measured 2026-09-15), so save to `.playwright-mcp/` and check that folder is gitignored before committing.

**WR-12 Never estimate length by eye — measure it with a script first (user directive 2026-07-23).** Measured failure: three seed stories were estimated by eye and were off by -22%, -16% and **-40%** (an estimate of 3,800 characters against an actual 2,281), and a cost estimate had been layered on top of the wrong numbers. It surfaced only when the user counted 392 characters themselves.

- **The reference metric is 전체 — every character including spaces and newlines.** Korean paragraphs are short and newlines frequent, especially in web fiction, so excluding newlines diverges from the actual reading burden. Several counting conventions exist, so agree with the user on which one first.
- Have the script emit several metrics at once (전체, 줄바꿈제외, 공백제외, 한글음절, 어절, 문단) to make that agreement easy.
- **The Korean console is cp949**, so printing a Korean filename or body to stdout corrupts it. Write results as UTF-8 JSON and read them with the Read tool; keep stdout to one ASCII line.
- **When a pipeline handles length, do not have the model count.** Models get character counts wrong. Code counts and inserts the number.

## 5. Design

**WR-13 Subtract, and stay calm.** The user dislikes dense, cluttered information: strip to essentials. Colour is a muted, brightness-adjusted chromatic — neither pastel nor achromatic, and not either extreme. Form is rounded and soft.

## 6. New rules

**WR-15 Verification status stays out of the deliverable (user directive 2026-08-09).** Evidence grades, bracketed source caveats and my own open questions — "미검증", "측정해야 함", "확인할 것" — go in the message to the user, never into the body of the thing a person reads. G-05 and G-07 govern what I must know and must say; they do not license annotating the artifact. And match verification depth to the stakes: a hackathon pitch is not a legal filing. Measured 2026-08-09 — the user said "기획이 합리적이되 반드시 모든 부분이 객관적이지 않아도 됨. 약간의 망상 가능", and the diagnosis was that what burdened the deck was the homework list outside the slides, not the slides. Loosening the prose instead is the overcorrection that followed, and it was rejected too ("너무 캐주얼 해졌는데.. 대체 너는 어떤 기준인거야?"). Depth changes are said in chat; the artifact just reads clean.

**WR-16 In a narrative deliverable the reader's viewpoint outranks these rules (user directive 2026-09-09).** A 계획서, 자소서 or 지원서 is read by one person deciding one thing. Settle whose eyes it is written for and what they are deciding *before* any style question, then let the rules bend: "코드 작성이나 설계 문서와 달리 계획서, 자기소개서 등의 서술 중심의 문서는 규칙을 완벽히 준수하지 않아도 괜찮아."

- **The measured failure.** On a 중소벤처기업부 application I spent a session measuring 연결어미 per sentence, 정도부사 per 1,000자 and sentence-length variance, and rewriting to hit them. The real defect was structural and an outside reader saw it in one pass: the document was written as **my own verification log** — competitor surveys I could not finish, premises I had got wrong, byte-level before and after — instead of as a submission. Every metric passed while the document was still wrong. **A measurable proxy is not the judgement.** When a style number and "would the reader want this sentence" disagree, the reader wins.
- This is the load-bearing half of WR-15. WR-15 keeps verification *annotations* out of the body; WR-16 says the document's centre of gravity must be the reader's decision, not my audit trail. Self-audit material goes to a working file. What verification *produced* — dates, counts, first-party sources — does belong in the submission, because to the reader those are evidence, not caveats. Deleting them along with the caveats is the opposite error, and it showed up as six answers landing 20% under their character floor with the material sitting unused.
- Narrative deliverables only. Code, specs and design documents keep strict compliance; there the rule is the contract.

**WR-17 Measured baselines for Korean human prose, and the ones that decide nothing (2026-09-09).** Two corpora were collected verbatim and measured: **실제 합격 자소서 15문단 4,986자** (2021 상반기, pre-ChatGPT) and **창업 회고 9편 10,682자** (5편 pre-2023). Use only what both agree on.

Agreeing, so usable:
- **Punctuation is zero.** 줄표, 가운뎃점, 콜론, 세미콜론 each appeared **0 times in 10,682자**; parenthetical asides appeared 17 times instead. This turns WR-3 from a preference into a measurement.
- **정도부사 3.5~6.6 per 1,000자** (회고 3.5, 자소서 6.62, this user's own unedited paragraph 9.55). Prose at 0 reads flat no matter how clean it is; 「너무」 survives even in an accepted 자소서.
- **Digits, not spelled-out numbers**, around 14 per 1,000자. And the numbers sit on *unfavourable* facts — 부채비율 600%, 「그전에는 5명이었다」, 방문자 4천명인데 접기로 했다. Self-accounting, not boasting.
- **Emotion arrives as bodily sensation, not adjectives** — 심장이 쿵쿵, 숨이 막혔다, 손발에 땀났지만. 「막막」 appeared **0 times across both corpora** despite being the obvious cliché.
- **What the Korean detector publishes** (무하유 GPT킬러, 5 items): 추상적·일반적 내용 구성 / 주관성의 지나친 배제 / 과도하게 경직된 문어체 / 무견해, 판단 회피적 성향 / 동일 내용의 과도한 반복. Rendering "객관적으로 담백하게" as *subjectivity removed* walks straight into the second one.

Contradicting, so **not** discriminators — never revise toward them:
- 문장 평균 길이 (자소서 73.0자 vs 회고 38.4자), 변동계수 (0.31 vs 0.69), 두괄식 문단 (5/5 vs 2/9), 자기 언급 (2.81 vs 6.9 per 1,000자), 문두 접속부사 (26.6% vs 9.0%). Genre decides all five, not authorship. Forcing variance produced 12자 punch lines that read as ad copy; the human corpus's shortest 자소서 sentence was 33자.
- 『교양교육연구』 2025 (2021학년도 인간 과제물 대 2025학년도 AI 활용 과제물 69편) found AI-assisted writing **shorter** than human writing and **no significant difference** in 접속부사 frequency. GPTZero dropped perplexity and burstiness from its own detector in autumn 2023.
- What actually marked the human 자소서 as human was **uncorrected errors (8+)** and **unverifiable specific numbers** — 150여 명의 독거노인, 8권이 넘는 실습일기, 연간 6만 건. So supply real specifics; never manufacture variance.

Caveat: no genuinely submitted 사업계획서 body could be obtained (search returns only paid report resellers), so these two genres bracket it rather than being it.

**WR-14** Add new writing and design directives here, and update the rule count in the header. Per-deliverable detail (verb-ending conventions and the like) goes in that project's memory.
