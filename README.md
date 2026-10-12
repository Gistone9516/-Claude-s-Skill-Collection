# work-panel

Claude Code mod로 만든 작업 현황판이다. 왼쪽 VS Code에서 일하는 세션의 요청과 진행 메모를, 오른쪽 CLI의 패널에 보인다.

VS Code 확장(2.1.296)은 mod 화면을 그리지 않는다(anthropics/claude-code#99045). 그래서 모든 세션이 자기 상태를 mod의 공용 저장소(`$.store`)에 올리고, `/panel`을 연 CLI 세션이 가장 최근에 움직인 다른 세션을 그린다. 동작 규칙(P-1~P-17)과 검증(V-1~V-6)은 [docs/SPEC.md](docs/SPEC.md)가 단일 출처다.

## 구조

```
.claude-plugin/plugin.json   mod 이름과 버전
hooks/register.tsx           등록만 한다. 이벤트를 받아 core에 넘기고, 그리기를 view에 넘긴다
src/core.ts                  엔진을 모르는 순수 함수. 상태를 바꾸는 판정은 전부 여기
src/core.test.ts             core 단위 시험. 시험 이름에 규칙 ID
src/view.tsx                 화면 조각. 상태를 받아 트리만 그린다
docs/SPEC.md                 설계서
```

`$`는 `register.tsx` 최상위에 선언한 함수에만 넘길 수 있다. 엔진이 소스를 정적으로 읽어 호출을 추적하기 때문이다.

## 실행과 검증

```
claude plugin validate .     # 엔진이 받아들이는지
claude plugin test .         # core 단위 시험
```

PATH의 `claude`가 2.1.287보다 낮으면 mod를 모른다. VS Code 확장에 들어 있는 엔진(`~/.vscode/extensions/anthropic.claude-code-<버전>/resources/native-binary/claude.exe`)으로 돌린다.

두 환경 모두 `~/.claude/settings.json`의 `env.CLAUDE_CODE_PLUGIN_DIRS`에 이 폴더를 넣어 불러온다. 공용 저장소 파일 이름이 mod를 불러온 경로에서 정해지므로, 두 환경이 반드시 같은 경로를 써야 같은 저장소를 본다.

## 현재 상태

1차 조각: 작업 탭(요청, 진행 메모)과 `panel_post` 도구. 헤드리스 세션에서 공용 저장소에 쓰는 것과 도구 응답까지 확인했고, 두 세션을 실제로 연결하는 시험(V-6)이 남았다. 할 일, 규칙, 에러, 기록 탭은 설계서에만 있다.
