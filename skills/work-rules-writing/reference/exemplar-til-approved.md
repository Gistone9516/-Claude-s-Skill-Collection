# Exemplar: the TIL the user picked as best (2026-10-11)

Of four blind samples written from the same day's session, the user chose this one: "공부 노트 1편이 가장 마음에 드는데." The features below were drawn from its form with the user, who added the first one ("개조식으로 명확히 띄워놨다는 것도 특징이지"). Describe and judge new writing by these features, never by listing rule violations ("규칙 위반 건을 명확히 집어서 이야기하면 안돼. 서술 형식에서 특징을 명확히 따와야지.").

## Features

Layout
- Clearly spaced 개조식: no dense paragraph anywhere, so the whole note can be skimmed at a glance.
- One item is one line, two sentences at most. A long thought becomes a parent item with indented children.
- Two levels of indentation at most.
- No bold or emoji inside the items; emphasis lives in the headings only.

Flow
- The title states the conclusion the day arrived at.
- Headings follow how the thinking moved that day: background, the question, what was tried, the turn, the conclusion.
- Questions actually asked become headings ("~건가?", "근본적인 문제가 있나?").
- The parent item is the thought; the indented children are its reason or example. Indentation shows the relation, not connectives.
- An observation is followed by a short realisation ("재료가 이미 문장이면 거의 그대로 옮김. 규칙보다 재료의 모양이 더 큼").
- 「즉,」 restates a point in the writer's own words.
- Attempts carry their condition in parentheses ("1차 (재료를 문장으로 줌)").
- Failed attempts stay in, so the change of mind can be read.
- Each section closes on a line that comes straight from what happened, so it never reads as an added lesson. The last section closes on 남은 것.

Wording
- The user's own words are woven in ("유도리", "오버피팅", "매한가지", "전 서술보다 별로"), which is what makes a tidy note sound like them.
- The point of a section is often carried by one contrast: "A가 아니라 B", "개선 말고 재구축", "규칙 대신 예시".
- Exact wording is quoted, including before and after ("중단됐다는 글이 여럿" → "중단됐다").
- 「그래서」 and 「그런데」 appear only where the story actually turns, at the start of an item.
- The subject is dropped; it reads as their own story without 「나는」.
- A guess stays a guess, lightly: 「~것 같음」.
- Everyday evaluative words: 자꾸, 매한가지, 별로, 과해짐.
- 음슴체 endings (~함, ~음, ~것) with an occasional question.

Selection
- Process trivia is dropped hard: no agent counts, file paths or percentages. Only the numbers that matter stay ("사실 10개", "조건당 2~3편", "05:30"). What was learned is weighed, not counted: what matters goes in at the depth the conversation reached, and a topic that took long talk but carries little weight gets its core in two sentences at most (user, 2026-10-11).
- Proper nouns are kept as they are (portfolio-log, work-rules-writing, WR-16).

## Short form, for a topic of little weight (user, 2026-10-11)

Written by the user to show the feel they want ("나는 이런 느낌을 원해"):

```
- 채점이 8초대라 느렸음. 채점마다 세션을 생성했기 때문으로 분석
- haiku 모델 교체는 오히려 사전 프롬프트에서 병목, sonnet 세션을 이어 쓰게 바꾸니 2초대 개선
```

- The first line is the problem and its cause, with how the cause was known (「~때문으로 분석」).
- The second line is the attempt, why it failed in a few words (「오히려 사전 프롬프트에서 병목」), the fix and the result with a number, joined by commas.
- Noun-form endings (~음, ~으로 분석, ~개선); no connectives; technical names kept exact.
- A version that said only that the model change 「효과가 없었고」 lost the reason it failed, and is what this replaced.

## The note (verbatim)

```
# TIL 2026-10-11 AI 글쓰기 지침은 규칙을 늘리는 게 아니라 구성과 예시로

## 배경
- 원래 하던 건 portfolio-log 스킬. 하루치 세션 기록을 모아 일지로 남기는 스킬
  - 매일 공개 커밋은 잔디 채우기로 보일 수 있다는 의견이 있어서, 비공개 일지와 골라 쓰는 공개 글의 2단 구조로 정함
  - '오늘'의 기준은 새벽까지 공부하는 날이 많아서 05:30
- 그런데 Claude가 쓰는 글이 자꾸 어색함. 규칙을 지키느라 문단 흐름이 아니라 문장을 이어 붙이는 방식이 돼서 그런 것 같음
  - 글 쓰는 데는 어느 정도 유도리가 필요함. 규칙을 과하게 주면 오버피팅돼서 매우 어색한 글이 됨
- 그래서 스킬은 보류하고 work-rules-writing부터 손보기로 함

## work-rules-writing 때문에 항상 글쓰기가 애매했던 건가?
- 부분적으로만 맞음. 이 파일 하나만의 문제는 아님
- 같은 문제가 이미 WR-16에 기록돼 있었는데, 그때 대응이 규칙 줄이기가 아니라 문단 더 붙이기였음
  - 즉, 규칙 때문에 생긴 문제를 규칙을 늘려서 막으려 한 것
- 문단 더 붙이기는 적당히 운용해야 함. 프롬프트에 남겨야 같은 실수를 안 한다지만 정도가 과해짐

## 블라인드 비교로 알게 된 것
- 1차 (재료를 문장으로 줌) 규칙 없음, 현재 규칙, 줄인 규칙 세 편이 차이가 너무 없어서 판별 불가
  - 재료가 이미 문장이면 규칙이 있든 없든 거의 그대로 옮김. 규칙보다 재료의 모양이 더 큼
- 2차 (키워드 메모) 한 편은 너무 AI틱, 나머지 둘도 마음에 안 들긴 매한가지
  - 세 편 모두 메모의 사실 10개를 하나도 안 빼고 다 넣었음. "주어진 사실만 쓸 것"을 "전부 쓸 것"으로 받아들인 것
  - 진단은 "재료는 많지만 조화롭지 않다". 중심이 없으니 모든 사실이 같은 무게로 나열됨
- 3차 중심을 하나 정하고 재료를 버리게 함. 그런데 "중단됐다는 글이 여럿"이 "중단됐다"로 단정돼 버림
  - 흐름을 다듬다 보면 단서가 떨어져 나감. 출처의 확신 수준은 그대로 옮겨야 함

## 개선 말고 재구축
- GPT 교차 질문으로 지침을 다시 짬. 새 결과는 점점 나아지는 중이었음
- 그런데 GPT 제안대로 "겪은 순서 대신 논리 순서"로 바꿨더니 전 서술보다 별로
- 이 정도면 근본적인 문제가 있나? 규칙 문구보다 고치는 방식이 문제였음
  - 조건마다 글을 한 편씩만 써서 비교함. 같은 지침도 매번 결과가 달라서 우연과 효과를 구분 못 함
  - 고치고, 한 번 보고, 다시 고치는 땜질을 글에 한 셈
  - 앞으로는 조건당 2~3편씩
- 규칙은 구성은 바꿔도 문체와 목소리는 거의 못 바꿈. 그래서 규칙 대신 예시
- GPT는 무료 플랜이라 컨텍스트가 짧음. 같은 말을 번복할 수 있으니 유의

## 결론은 글 종류마다 달라야 함
- 예시로 고른 글은 velog의 AWS IAM 노트. 잘 쓴 건 아니지만 개인의 의견과 이론이 잘 어우러짐
  - 개조식에 음슴체인 공부 노트. 이론 사이사이에 글쓴이의 이해가 끼어듦 (묻고 답하기, "즉,"으로 다시 풀기, 아는 것에 빗대기, 판단이 담긴 강조)
- WR-2를 글 종류별로 나눔
  - 산문은 이어진 문단으로, 겪은 순서대로
  - 공부 노트와 TIL은 개조식에 내 이해를 끼워 넣기. 그 이해는 내가 실제로 던진 질문에서 가져옴
  - 슬라이드는 기존 WR-6~8
- 남은 것은 조건당 2편씩 다시 측정하기 (산문 2편, 공부 노트 2편)
```
