---
name: work-rules-diagnosis
description: 원인 진단·디버깅·코드 변경(추가/제거/리팩토링) 규율 (실측 반복실패에서 나온 사용자 지시). 버그 원인 특정, 근본원인 분석, 기능 제거·무력화, inert 코드 처리, 처방·실험 설계 전에 반드시 전문 정독. Triggers - 디버깅, 원인 분석, root cause, 왜 안 되지, 기능 제거, 리팩토링, 삭제, 처방.
---

# work-rules-diagnosis — 원인 진단·변경 규율

전부 실측 반복실패에서 사용자가 직접 세운 규율이다. 진단·처방·제거·추가의 4국면을 다룬다.

## 1. 근본원인 진단 — 단일축 확증편향 금지, 다가설 먼저 (user directive 2026-07-06)
원인 특정에서 반복적으로 틀린 근본 이유 = 한 축에 확신하고 그것만 파는 확증편향. 실측: 한 게임의 무승부 원인을 economy → cross-race → chip → RC-8로 네 번 연속 오진, 매번 "이게 원인"이라 단정했다가 사용자가 교정.
- ① 처방·단정 전에 가능한 원인 가설을 여럿 먼저 리스트업한다(하나에 꽂히지 말 것).
- ② 각 가설을 트레이스·로그·코드로 배제/확인하되, 확인 전엔 "이게 원인" 단정 금지 — "후보들"로 제시.
- ③ 어느 가설부터 파고들지 사용자에게 허락을 받는다(사용자가 현상을 더 잘 볼 때가 많음. 실측: 사용자가 "문앞 정체", "원기옥 분할" 등 결정적 관측을 줌).
- ④ 타임라인으로 상황을 먼저 설명한다 — 시점별 상태 표(무엇이 언제 바뀌었나)가 흐름을 가장 명확히 전달(실측: T175 gold → T180 파산 → T197 돌격 타임라인이 원인 합의를 만들었다).
- 적용: opus 본인 + 위임 에이전트 공통.

## 2. 단서 발굴 깊이 — 얕게 준비하면 얕은 결과만 나온다 (user directive 2026-07-08)
처방 전에 단서를 exhaustive하게 파라. 준비 깊이가 곧 결과 깊이다.
- ① 관측치가 아니라 내부 정본(ground truth)을 복원 — 재현/replay로 시스템의 내부 상태·결정(역할·신호·예약 이유)을 뽑는다. 로그 관측치는 "무엇", 내부 트레이스는 "왜"를 답한다(실측: faithful replay로 내부 role census·신호 타임라인을 복원해야 "왜 유닛이 논다"가 풀렸다).
- ② 다축 전수 채굴 — 가능한 모든 축(전투·경제·레벨·자원·위치·전략 등)을 열거하고 각 축의 단서를 구체 수치 + 시점으로 전부 뽑는다(요약 금지, "day150 51턴 n=0"식으로).
- ③ 승-패 자연실험 — 성공과 실패 사례를 대조해 승패를 가르는 단일 discriminator를 찾는다(실측: press 발동 유무가 승패를 갈랐다).
- ④ 아이템별 팬아웃(1로그=1에이전트)으로 exhaustive 추출 → opus가 시나리오로 종합(단서를 유형별로 묶어 축을 관통하는 시계열 흐름으로).
- ⑤ 근본원인이 code-locatable한 "게이트 인벤토리"로 좁혀질 때까지 계속 판다. 사용자의 "더 파 / 구체적으로 / 축별로" 압박은 아직 얕다는 신호 — 한 겹 더.

## 3. 메모리 전수 정독 — 처방 전 실패 대조 (실측 2026-07-04)
- 처방·실험·설계 착수 전에 관련 메모리를 전수 정독한다. MEMORY.md 인덱스 한 줄 요약으로 갈음 금지 — 요약은 규칙의 존재만 알려주고 날카로운 금지선은 본문에만 있다. (실측: 본문 안 읽고 self-play로 성과 판정하는 금지 행동을 세션 내내 반복, 성능 붕괴 후에야 규칙을 열었다.)
- 처방 확정 전 "이게 밟는 기록된 실패는?"을 명시적 대조 단계로 둔다. 실패 카탈로그 전체 + 관련 코드 주석과 대조 후에만 확정. 게이트(빌드/시뮬/submit) 통과를 성과 검증으로 오인 금지 — 게이트는 구조 회귀만 잡고, 성과 정본은 실전 로그다.
- 흩어진 실패 교훈은 카탈로그 한 곳으로 단일화(코드 주석에만 있으면 대조에서 누락된다 — 실측).

## 4. 변경 전 "왜 있나" 확인 — 추가는 소비처, 제거는 목적 (실측 2026-07-04)
상위 원리: 코드·신호·기능을 건드리기 전에 "이게 왜 있나 / 무엇을 지탱하나"를 먼저 확인한다. 재발 방지의 핵심은 개별 사례가 아니라 이 상위 원리로 판단하는 것(사례에만 매칭하면 형태가 조금만 달라도 규칙이 안 뜬다).
- **[추가] 새 신호/필드는 "설정"만으로 작동하지 않는다.** 그 값을 읽어 행동을 바꾸는 소비처(consumer)가 있는지 grep으로 확인. set-but-unread 신호는 컴파일·게이트를 다 통과하고도 런타임에 아무 일도 안 하는 inert 기능으로 출하된다(실측: 신호를 세팅만 하고 3커밋 출하, 역렌즈가 적발). 탑재 != 작동. 표준: ① `grep <signal>`로 read 사이트 세기 ② 그 read가 실제 행동을 바꾸는지 확인 ③ 없으면 소비처를 같은 커밋에. 위임 에이전트에게도 "새 신호는 소비처까지 구현·검증" 명시.
- **[제거: inert 발견 시] 삭제/재건 전에 git 이력으로 3분류 (user directive 2026-07-04).** grep은 "안 도는 것"만 알려준다. ⓐ 미완성(소비처 미구현) → 배선 ⓑ 되돌린 잔해(소비처가 회귀로 의도적 삭제됨) → 삭제 + 재건 금지(재건 = 그 회귀 재발) ⓒ 창세기 투기(처음부터 소비처 없음) → 무해, 선택 정리. `git log -S <symbol>` + 도입/삭제 커밋 메시지로 판별. 소비처 없다고 급히 자르면 ⓐ를 죽이거나 ⓑ를 재건하는 오판(실측: foe_deep이 ⓑ — 재건했으면 삭제됐던 회귀 부활).
- **[제거: 작동 중] 검증된 기능을 부작용만 보고 제거 금지 (실측: war_want).** 한 전선의 문제를 고치려 기능을 원흉으로 지목해 제거할 때, 그게 다른 전선을 지탱하는지 확인(실측: upkeep 병목 원흉으로 지목해 전면 제거 → 실은 검증된 격파 엔진이라 성능 6→2 붕괴, 당일 재설계). 목적이 살아있으면 제거가 아니라 조건화 — 진짜 결함은 "존재"가 아니라 "무차별 발동"인 경우가 많다.
- **["삭제가 행동 무변인가" byte 검증 시] 로그 노이즈 필터 필수.** 게임 로직은 결정론적이어도 로그엔 비결정 잡음이 섞인다: 응답시간 텔레메트리(`^TIME `), 실행 커맨드 헤더(`COMMAND:`), 디버그(`^#`). 안 거르면 무해한 삭제도 DIFFERS 오판. `diff <(grep -avE '^#|COMMAND:|^TIME ' new) <(... old)`로 비교하고, A/B는 한 WSL 호출 안에서 빌드+실행+비교를 끝낸다(work-rules-shell §2의 /tmp 함정과 결합).

## 5. Anti-patchwork rules (user directive 2026-07-28, global)

User's diagnosis, verbatim: **"버그 수정-테스트-버그 수정-테스트 같은 굴레에서 도출되는 결과물은 결국 적층형 땜질 스파게티 코드이기 때문이지."** This is the whole reason software-engineering patterns are being adopted here — not elegance, but because the patch-test loop provably degrades a system.

The mechanism: **a patch does not know what it broke.** When an earlier decision exists only implicitly inside code, a later patch reverses it silently and still passes every test.

Measured (배경노트 v1→v2): v1's judgments were sound and even well-commented — `theme.css:451-456` states the exact width bug its override fixes; another comment records "어려워요는 답이 아니라 난이도 신호". The failure was that these decisions sat scattered in code comments, so **nobody could enumerate them.** Consequence: v2's first web slice re-imposed a width cap v1 had deliberately removed, and a double-counter bug in the narrowing flow shipped in v1 and survived months.

### 5-1. Behavior rules carry ID, source, rationale, test

Write behavior rules as a table in the spec before implementing. All four elements required:

| Element | What breaks without it |
|---|---|
| ID (B-1, D-2 …) | A later patch cannot name what it violates |
| Source (file:line, or user-confirmed date) | The decision gets re-investigated from scratch |
| Rationale (why) | A future session "improves" it and reintroduces the original problem |
| Test (case name) | No way to tell whether the rule is still alive |

Rationale is load-bearing. "Undo returns to the first question" is meaningless alone; "because stepping back one turn re-calls the API every time and round-trip cost becomes uncontrollable" is what stops someone from changing it.

### 5-2. Classify before fixing

When a bug appears, do NOT go straight to code. Decide which of three it is:

| Class | Action |
|---|---|
| Implementation violated a rule | Fix code + add that rule's test |
| The rule was wrong | **Amend the spec first**, then implement |
| The rule was missing | **Add the rule first**, then implement |

"Just fix it" is not one of the options. Skipping this classification is exactly how decisions accumulate in code only, which is the definition of 적층형.

### 5-3. Prefer impossible over checked

Allowing a bad state and guarding it with checks yields a bug at every path that forgot the check. Make the state unrepresentable instead.

- Bad: keep two counters, test that they agree
- Good: keep one counter, derive the rest — what is not stored cannot drift

Measured: v1's "어려워요" bug existed because turn budget and answer count were stored separately. Merging them made the bug impossible to reproduce and cut the termination condition from three branches to two.

### 5-4. Spec precedes substantial change

Any change that substantially alters a subsystem gets a spec first — behavior-rule table, contracts (types/signatures), verification table — reviewed before implementation.

Measured both directions in one session: a 51-site CSS change made without a spec went in the wrong direction entirely and was reverted; the next slice, specced first, surfaced two long-lived v1 bugs before a single line of code was written.

### 5-5. Size is a signal, not a rule

Line count decides nothing; single responsibility does. At ~300 lines ask "is this one responsibility?" If yes it may exceed, and gets registered in the size gate's allowlist with a stated reason so the exception is visible instead of hidden. Measured: a 564-line design-token CSS file is one design system (register); a 904-line component holding 10 screens and 50 state fields is not (split). User's words: "300줄 규칙은 절대 규칙이 아님… 파일 구조 상 효율을 위해 예외를 둬야한다는 건 어쩔 수 없는 일이지."

## 6. 새 교훈 발견 시
진단·변경 규율 관련 신규 교훈은 실측 날짜와 함께 이 파일에 추가한다(실수 자기학습 규칙).
