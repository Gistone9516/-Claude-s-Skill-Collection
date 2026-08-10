# Claude 전역 설정 저장소

Claude Code의 전역 규칙과 스킬을 담아 여러 컴퓨터 사이에서 동기화하는 저장소다. `~/.claude`에 그대로 clone 해서 쓴다.

## 구조

```
CLAUDE.md          전역 규칙 17개. 매 턴 자동 로드. 나머지는 전부 스킬에 있다
manifest.json      이 설치본이 갖춰야 할 스킬, 파일, 외부 앱 경로의 단일 출처
GUIDE.ko.md        사람이 읽는 상세 안내. 스킬 목록과 선택 기준, 이식 절차
settings.hooks.example.json  훅 배선 템플릿. settings.json 자체는 컴퓨터마다 달라 넣지 않는다
scripts/
  check-manifest.ps1   세션 시작마다 매니페스트와 실제 파일을 대조하고 경고
  guard.ps1            결과를 보는 훅. 쓰여진 파일과 만들어진 커밋을 검사
  pattern-guard.sh     명령문을 보는 훅. 파괴적 구문 9종을 실행 전에 경고
  brief-nudge.sh       상기시키는 훅. 처음 건드리는 파일에 브리핑 쌍을 제안
  manifest-nudge.sh    상기시키는 훅. SKILL.md를 고치면 매니페스트도 함께 고치라고 알림
  validate_doc.py      한국어 분량 실측
skills/            스킬 21개. 직접 만든 14개와 외부 7개
projects/<경로키>/memory/   폴더 단위 프로젝트 메모리
```

## 설계 핵심

규칙을 세 층으로 나눈다. 기준은 **지침이 행동하는 순간에 얼마나 가까이 있느냐**다.

| 층 | 무엇이 | 왜 |
|---|---|---|
| 훅 (`scripts/`) | 기계적으로 탐지 가능한 규칙 13종 | 가장 가깝다. 어길 수가 없다 |
| 스킬 | 그 작업을 할 때만 필요한 상세 수칙 | 작업 직전에 읽으므로 가깝다 |
| CLAUDE.md | 스킬을 읽기 전에 이미 참이어야 하는 것만 | 항상 있지만 그만큼 희석된다 |

세 층으로 나눈 근거는 실측이다. 스킬을 전문 정독하고도 같은 규칙(cp949 stdout)을 한 세션에서 두 번 어긴 일이 있었다. 파일 위치가 아니라 거리가 문제였다. 그래서 기계적으로 잡히는 것은 훅으로 내렸고, 나머지 중 CLAUDE.md에 요약본으로 중복돼 있던 11개는 지웠다. 스킬에 더 자세히 들어 있는데 요약본이 옆에 있으면 정확도만 떨어진다.

모든 규칙에는 고정 ID가 붙는다. 전역은 `G-`, 스킬은 접두어별로 `SH`(셸), `DG`(진단), `VF`(검증), `AU`(자동화), `WR`(글쓰기), `DC`(문서), `KT`(킷), `AO`(위임), `DF`, `BF`, `HX`를 쓴다. 순서를 바꿔도 상호 참조가 살아 있고 어느 규칙을 어겼는지 지목할 수 있다.

각 스킬 파일 머리에는 규칙 개수가 적혀 있다. 개수가 안 맞으면 규칙이 소리 없이 추가되거나 사라진 것이다.

AI가 읽는 파일은 전부 영어로 쓴다. 사람이 읽는 파일(이 README와 `GUIDE.ko.md`)만 한국어다.

## 새 컴퓨터에서 쓰기

```bash
git clone https://github.com/Gistone9516/-Claude-s-Skill-Collection.git ~/.claude
```

그다음 훅을 등록한다. `settings.hooks.example.json`의 `hooks` 블록을 통째로 `~/.claude/settings.json`에 옮기고, 안에 있는 `<CLAUDE_HOME>` 아홉 군데를 자기 경로로 바꾸면 끝이다.

```
<CLAUDE_HOME>  ->  C:/Users/<계정>/.claude
```

역슬래시가 아니라 슬래시로 적는다. PowerShell과 bash가 둘 다 이 형태를 받으므로 훅마다 경로 표기를 달리할 필요가 없다.

`settings.json` 자체는 저장소에 넣지 않는다. 모델과 권한 설정처럼 컴퓨터마다 다른 값이 함께 들어 있어서, 옮겨 가면 맞을 이유가 없는 파일이기 때문이다. 옮겨야 하는 것은 훅 배선뿐이고 그것만 예제 파일로 떼어 뒀다.

등록되는 훅은 네 이벤트에 걸쳐 일곱 묶음, 명령 아홉 개다.

| 이벤트 | 등록되는 것 |
|---|---|
| SessionStart | check-manifest.ps1 |
| PreToolUse | pattern-guard.sh(셸 명령), brief-nudge.sh check(파일 편집) |
| PostToolUse | guard.ps1(파일 편집), brief-nudge.sh record, manifest-nudge.sh, guard.ps1(git 명령, Bash와 PowerShell 각각) |
| PostToolUseFailure | guard.ps1(셸 실패) |

세션을 띄우면 검사기가 빠진 스킬, 미등록 스킬, 이름 불일치, 규칙 ID 범위 어긋남, 예산 초과, 그리고 이 예제 파일과 실제 `settings.json`이 갈라진 것까지 알려 준다. 아홉 가지 항목 전부는 [GUIDE.ko.md](GUIDE.ko.md)에 있다. 수동 확인은 아래와 같다.

```
powershell -NoProfile -File "~/.claude/scripts/check-manifest.ps1" -Mode report
```

## 현재 상태

2026년 7월 29일에 전면 재정비했다. CLAUDE.md를 17,848바이트에서 8,555바이트로 줄이면서 규칙은 하나도 버리지 않았고, 스킬 본문을 영어로 통일했으며, 매니페스트 검사 체계를 새로 넣었다. 중복이던 `custom skill docs/` 폴더와 그 동기화 훅은 폐기하고 `GUIDE.ko.md` 한 장으로 대체했다.

`discord-bridge`와 `learning-harness` 두 스킬은 이번 정비 범위에서 제외했다. 매니페스트에는 등록되어 있고 본문은 이전 상태 그대로다.

자세한 내용은 [GUIDE.ko.md](GUIDE.ko.md)를 본다.
