# Measured baselines for Korean human prose (2026-09-09)

Reference data, moved out of SKILL.md on 2026-10-11 so it is not read as a target. **Never revise a draft toward these numbers.** WR-3 cites the punctuation line as its evidence; WR-2 cites the "real specifics" line. Everything else here is background.

Two corpora were collected verbatim and measured: **실제 합격 자소서 15문단 4,986자** (2021 상반기, pre-ChatGPT) and **창업 회고 9편 10,682자** (5편 pre-2023). Use only what both agree on.

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
