# portfolio-log

하루 동안의 Claude Code 세션에서 이슈가 있었던 부분을 골라 비공개 공부 노트로 남기는 스킬. 동작 규칙(PL-1~PL-19)은 SKILL.md가 단일 출처다.

| 파일 | 맡은 일 |
|---|---|
| `SKILL.md` | 진행 순서와 규칙표. 모델이 읽는다 |
| `scripts/plog.py` | 수집기. `collect`, `set-folder`, `paths`, `errors`, `candidates-used` |
| `tests/test_plog.py` | 수집기 단위 시험. 시험 이름이 규칙표의 Test 열과 같다 |

```
python -I scripts/plog.py collect [--date YYYY-MM-DD]
python -I scripts/plog.py candidates-used [--date YYYY-MM-DD]
python tests/test_plog.py
```

일지는 이 저장소 밖 `~/portfolio-journal/`(환경변수 `PORTFOLIO_JOURNAL_DIR`)에 쌓인다. 노트, 다이제스트, 후보 파일은 개인 기록이라 여기에 두지 않는다.

상태: 1단계(비공개 노트)는 설계를 마쳤고 처음부터 끝까지 돌려 본 적은 아직 없다. 2단계(쌓인 노트에서 골라 블로그에 게시)는 착수 전이다.

후보 형식은 현황판 mod(`mods/work-panel`, P-10, P-11)와 함께 쓴다. `plog.py`의 `CANDIDATE_FIELDS`와 mod의 `Candidate` 타입이 어긋나지 않게 둘을 같은 커밋에서 고친다.
