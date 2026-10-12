# work-panel 설계서 (1차)

규칙: P-1~P-17 (17건), 검증: V-1~V-6 (6건)

Claude Code CLI 옆에 붙는 작업 현황판이다. 작업 중 상태(진행, 할 일, 규칙, 에러, 기록 후보)를 패널에 모아 두고, 채팅에는 결정이 필요한 것과 결론만 남긴다. 사용자 요청 2026-10-12: "패널에 띄워준다면 앞으로 내게 띄우는 메인 출력 컨텍스트를 최소화할 수 있겠지."

이 문서가 동작 규칙의 단일 출처다. 코드와 이 문서가 다르면 둘 중 하나를 고친 뒤 같은 커밋에 넣는다.

## 1. 어디에 그려지는가

사용자의 화면 구성(2026-10-12): 왼쪽은 VS Code 확장을 주 작업 창으로, 오른쪽은 CLI를 사이드 패널로 쓴다. "cli는 반응이 한 템포 느리기도 하고, UI 작업할 땐 vscode가 편하거든."

- **작업 세션 (주로 VS Code)**: 2.1.296의 확장은 mod 화면을 그리지 않는다(측정 2026-10-12, anthropics/claude-code#99045). 훅은 돌기 때문에 상태를 모아 `$.store`의 자기 세션 칸에 올린다.
- **현황판 세션 (CLI)**: `$.store`를 읽어 가장 최근에 움직인 다른 세션을 Pane에 그린다. 버튼과 입력칸은 여기에 있다.
- mod는 세션마다 따로 돈다. 두 세션을 잇는 것은 이 컴퓨터의 모든 세션이 함께 쓰는 `$.store`뿐이다.
- 로드는 `~/.claude/settings.json`의 `env.CLAUDE_CODE_PLUGIN_DIRS`에 이 폴더를 넣어 두 환경의 모든 세션에서 한다. 같은 mod가 그릴 화면이 있으면 현황판으로, 없으면 작업 세션으로 동작한다.

## 2. 계층 구조

```
hooks/register.tsx     등록만 한다. 이벤트를 받아 수집기에 넘기고, 그리기를 화면 조각에 넘긴다
src/collect/           수집기. 이벤트를 상태 변경으로 바꾸는 순수 함수 (스킬, 규칙, 에러, 저장소, 할 일)
src/state.ts           상태의 유일한 정의. $.state 원자와 $.store 키를 여기서만 만든다
src/view/              화면 조각. 상태를 받아 트리만 그린다. 상태를 바꾸지 않는다
src/sources/           바깥 읽기의 유일한 위치 ($.fs, $.process). 수집기는 이것을 통해서만 밖을 본다
types/index.d.ts       PluginState 계약
```

수집기가 순수 함수라 엔진 없이 단위 시험한다. 화면이 상태만 읽기 때문에 같은 판정이 탭마다 따로 구현되지 않는다.

## 3. 동작 규칙

| ID | 규칙 | 출처 | 이유 | 시험 |
|---|---|---|---|---|
| P-1 | `/panel`로 연다. 세션 시작 때는 화면 폭이 144칸 이상일 때만 스스로 연다. | 엔진 규칙: 요청 없이 연 패널은 144칸부터 배치 (Mods reference, Limits) | 좁은 화면에서 요청 없이 대화를 가리면 안 된다 | `opens on command` |
| P-2 | 탭은 작업, 할 일, 규칙, 에러, 기록 다섯이다. 숫자 1~5와 탭 버튼으로 바꾼다. 마지막에 본 탭을 기억한다. | 사용자 2026-10-12 (할 일, 과거 에러 추가 요청) | 한 화면에 다 넣으면 읽히지 않는다 | `switches tabs` |
| P-3 | 작업 탭은 현재 요청의 첫 줄, Claude가 올린 진행 메모, 실행 중인 하위 에이전트, 손댄 저장소의 커밋 안 된 파일 수와 push 대기 커밋 수를 보인다. | 효율성 평가 2026-10-12: push 대기가 세 번 쌓였고 에이전트 대기 중 상태가 안 보였다 | 채팅으로 묻고 답하던 상태를 한눈에 보이게 한다 | `work tab rows` |
| P-4 | Claude는 `panel_post` 도구로 진행 메모(진행, 완료, 결정 필요)를 패널에 올린다. 결정 필요 메모만 채팅에도 쓴다. | 사용자 2026-10-12 (메인 출력 최소화) | 진행 보고가 채팅을 채우면 결정이 묻힌다 | `post appears` |
| P-5 | 할 일은 사람이 입력칸으로 추가하고 버튼으로 끝낸다. Claude는 `todo` 도구로 추가하고 끝낸다. 목록은 세션을 넘어 남는다(`$.store`). push 대기는 할 일로 자동으로 올라오고, push되면 저절로 사라진다. | 사용자 2026-10-12: "TODO 현황판도 띄우면 좋겠다." | 할 일이 사람과 Claude 어느 쪽에서 생겨도 한 목록이어야 한다. 자동 항목은 저장하지 않고 매번 계산한다(DG-3) | `todo add and done`, `push item derived` |
| P-6 | 규칙 탭은 CLAUDE.md의 전역 규칙(항상), 이번 구간에 읽은 스킬과 규칙 범위, 압축으로 사라져 다시 읽어야 할 스킬을 보인다. 스킬의 규칙 범위는 본문의 `Rules: X-1..X-n (n)` 머리말에서 읽는다. | 사용자 2026-10-12: "어떤 작업을 위해 어떤 스킬을 호출했으며 … 컨텍스트에 올라와 있는 규칙 현황" | 제때 읽혔는지가 실측 19~43%였다 | `skill load parsed`, `compaction marks reload` |
| P-7 | 스킬 읽음은 `skill.prompt` 이벤트로 잡는다. Skill 호출, `/이름` 직접 입력, 하위 에이전트 사전 로드 모두 이 이벤트로 온다. 스킬마다 그때의 요청 첫 줄을 함께 남긴다. | Mods reference (`skill.prompt`) | 훅 원장(skill-gate)이 놓치던 직접 입력까지 잡는다 | `skill load parsed` |
| P-8 | 규칙 탭은 측정 가능한 전역 규칙의 이번 작업 상태를 보인다: G-10(요청 뒤 첫 수정 전에 에이전트 둘 이상), G-22(이번 작업의 에이전트 수), G-11(push 대기). 측정할 수 없는 규칙은 접힌 목록에만 둔다. | 기능 검토 2026-10-12 | 목록보다 "지금 지켜지는가"가 정보다 | `global rule checks` |
| P-9 | 발동한 규칙은 막힌 도구 호출의 사유와 훅 알림에서 `[G-27]`, `[skill-gate]` 같은 표시를 읽어 시각과 함께 쌓는다. | 기능 검토 2026-10-12 | 어떤 규칙이 실제로 일했는지 보여야 규칙을 고칠 수 있다 | `rule fired parsed` |
| P-10 | 에러 탭은 `plog.py errors`가 쓴 `~/portfolio-journal/errors/errors.json`을 읽어 지난 30일 요약과 반복 에러 상위 5를 보이고, 이번 세션에서 실패한 도구 호출을 실시간으로 더한다. 세션 시작 때 `plog.py errors`를 백그라운드로 한 번 돌린다. | 사용자 2026-10-12: "과거 세션에서도 에러 사항을 찾아주라." | 반복 에러는 작동하지 않는 규칙이다 | `errors loaded` |
| P-11 | 에러와 지적 항목마다 "기록 후보" 버튼이 있다. 누르면 `~/portfolio-journal/candidates.json`에 들어가고, 기록 탭에 쌓인다. `plog.py collect`가 그 파일을 읽어 다이제스트에 넣는다. | 기능 검토 2026-10-12 | 포트폴리오 기록 후보를 하루 끝에 다시 찾지 않게 한다. 소비자를 같은 커밋에 넣는다(DG-16) | `candidate written`, plog `test_candidates_in_digest` |
| P-12 | 패널은 Claude의 동작을 바꾸지 않는다. 도구 호출을 막거나 프롬프트를 고치지 않고, 읽고 그리기만 한다. 예외는 P-4, P-5의 도구 두 개다. | 설계 2026-10-12 | 스킬 게이트는 이미 별도 훅이 맡고 있다. 막는 장치가 두 곳이 되면 어긋난다 | `validate shows no deny` (V-2) |
| P-13 | 바깥 명령(`git`, `python`)은 턴이 끝날 때 한 번, 30초 이내에만 다시 돈다. 실패해도 패널은 마지막 값을 보이고 "갱신 실패"만 표시한다. | 엔진 제한: 훅 10초, `$.process.run` 기본 30초 | 패널이 작업을 느리게 하거나 멈추게 하면 안 된다 | `refresh throttled` |
| P-15 | 모든 세션은 자기 상태를 `$.store`의 `work-panel:session:<세션 id>` 칸에 1초에 한 번 이하로 올린다. 현황판은 몇 초마다 읽어, 자기 세션을 뺀 세션 중 가장 최근에 움직인 것을 기본으로 그리고, 패널에서 다른 세션을 고를 수 있다. 10분 넘게 움직이지 않은 세션은 목록에서 숨긴다. | 사용자 2026-10-12 (왼쪽 VS Code 작업, 오른쪽 CLI 현황판) | 현황판이 보여야 할 것은 옆 창에서 진행 중인 작업이다 | `publishes session state`, `viewer picks latest other session` |
| P-16 | 할 일과 기록 후보는 세션을 넘어 공용 칸에 둔다. 진행 메모, 요청, 읽은 스킬, 세션 에러는 세션 칸에 따로 둔다. 공용 칸은 여러 세션이 동시에 고칠 수 있으므로 읽고 고치고 쓰는 방식을 Mods 문서의 "Save from more than one session" 절차대로 한다(구현 전에 그 절을 읽는다). | 사용자 2026-10-12 (두 환경을 함께 씀) | 할 일은 하나여야 하고, 진행 상황은 섞이면 안 된다 | `todos shared across sessions` |
| P-17 | 현황판 세션은 몇 초마다 `work-panel:viewer`에 살아 있다는 시각을 남긴다. `panel_post`의 응답은 현황판이 켜져 있는지(최근 15초 이내 표시가 있는지)를 함께 돌려준다. 켜져 있으면 Claude는 진행 보고를 패널에만 하고 채팅은 결정과 결론만 쓴다. 꺼져 있으면 채팅에 보고한다. | 사용자 2026-10-12: "현재 환경에 cli가 켜져있는지 확인 절차". 스킬이 아니라 도구 응답에 둔 이유: 스킬은 필요한 순간에 읽히는 비율이 19~43%였다(측정 2026-10-12) | 판단에 필요한 사실이 행동하는 바로 그 순간에 도착해야 한다 | `post reports viewer state` |
| P-14 | 비밀값은 그리기 전에 가린다. 가림 규칙은 `plog.py`의 PL-7과 같은 목록을 쓴다. | portfolio-log PL-7, 측정 2026-10-12 (웹훅 주소 노출) | 패널은 화면 공유나 스크린샷에 그대로 찍힌다 | `masks secrets` |

## 4. 계약

```ts
// types/index.d.ts (PluginState['work-panel'])
tab: 'work' | 'todo' | 'rules' | 'errors' | 'record'
task: { text: string; at: string } | null                 // 현재 요청 첫 줄
posts: { kind: 'progress' | 'done' | 'decision'; text: string; at: string }[]  // 최근 50
skills: { name: string; rules: string | null; at: string; task: string; stale: boolean }[]
fired: { id: string; text: string; at: string }[]          // 최근 50
agents: { id: string; name: string; status: string }[]
repos: { path: string; dirty: number; unpushed: number; checkedAt: string; failed: boolean }[]
sessionErrors: { tool: string; text: string; at: string }[]
// $.store (세션을 넘어 남는 것)
'work-panel:todos': { id: string; text: string; done: boolean; by: 'person' | 'claude'; at: string }[]
```

도구:

```ts
panel_post({ kind: 'progress' | 'done' | 'decision', text: string })  // P-4
todo({ op: 'add', text: string } | { op: 'done', id: string })       // P-5
```

## 5. 화면

```
┌ 작업 현황 ───────────────────────────────┐
│ [1 작업] [2 할 일] [3 규칙] [4 에러] [5 기록] │
│ 요청  mod 패널 설계서 작성                    │
│ 진행  23:41 설계서 초안 작성 중               │
│ 결정  23:45 탭 구성 확인 필요                 │
│ 에이전트  없음                                │
│ 저장소  .claude  변경 0 · push 대기 0         │
│         myblog   변경 0 · push 대기 0         │
└───────────────────────────────────────────┘
```

색은 쓰지 않거나 최소로 쓴다(`work-rules-writing` WR-13). 상태는 글자로 말한다.

## 6. 검증

| ID | 무엇을 | 어떻게 |
|---|---|---|
| V-1 | 수집기 P-3, P-5~P-11, P-14 | `src/collect/*.test.ts` 단위 시험. 시험 이름에 규칙 ID를 넣는다 |
| V-2 | 모듈이 엔진에 받아들여지는가, 막는 훅이 없는가(P-12) | `claude plugin validate --strict` |
| V-3 | 타입 | `tsc -p .` |
| V-4 | 화면 P-1, P-2 | `claude plugin test`의 mount로 terminal과 desktop 두 화면에서 같은 시험 |
| V-5 | 실제 세션 (CLI) | CLI에서 `/panel`을 열고 다섯 탭을 스크린샷으로 확인 |
| V-6 | 두 세션 연동 | 왼쪽 VS Code 세션에서 일을 시키고, 오른쪽 CLI 패널이 몇 초 안에 그 세션의 요청과 진행 메모를 보이는지 확인. `$.store`가 실행 중인 두 세션 사이에서 실시간으로 보이는지는 미측정이라 첫 조각에서 먼저 잰다 |

## 7. 범위 밖 (2차)

컨텍스트 사용량 계기, 에이전트 비용 계기, 작업 타임라인, skill-gate 훅을 패널로 옮기는 일.
