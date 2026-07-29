---
name: work-rules-kit
description: 재사용 킷/프레임워크 프로젝트 수칙 (킷은 제네릭 유지). learning-harness, Discord Agents처럼 하나의 코드를 여러 인스턴스/과목이 공유하는 프로젝트를 건드리기 전에 반드시 전문 정독. Triggers - learning-harness, Discord Agents, 킷 수정, 프레임워크 공용 코드, 인스턴스 추가, 과목 추가.
---

# work-rules-kit — 재사용 킷/프레임워크 프로젝트 수칙

여러 인스턴스/과목이 소비하는 재사용 킷·프레임워크로 지어진 프로젝트(예: `learning-harness`, `Discord Agents`)에 적용.

- **킷 코드는 제네릭 유지 — 인스턴스/과목 리터럴 0.** 인스턴스 고유 정보(과목/영역 이름, 페르소나, 과제 문구, 채널, 토큰, 길드, 로스터, 작업폴더)는 전부 config/.env/data로 주입하고, 공유 킷 코드에 하드코딩하지 않는다.
- **인스턴스별 코드 포크/클론 금지.** 코드 사본 하나가 모든 인스턴스를 서비스한다. 인스턴스 간 차이는 data/config/.env뿐. 인스턴스 실행 = 하나의 킷을 그 인스턴스의 데이터 폴더로 지정(그 폴더의 .env가 채널/토큰 보유).
- **한 인스턴스 작업 중에 킷에 인스턴스 특이사항을 넣지 말 것** — 다른 인스턴스들이 의존하는 파일이 바뀐다. 킷 편집은 제네릭 기능만, 과목 특이 변경은 그 인스턴스의 config/data로. 가능하면 인스턴스 리터럴이 킷 코드에 새면 실패하는 테스트로 가드(learning-harness에는 `bot/tests/test_subject_agnostic.py`가 있다).
