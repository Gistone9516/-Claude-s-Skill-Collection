---
name: work-rules-docs
description: 문서 파일(hwpx·pptx·docx·xlsx) 편집·추출 수칙 (실측 손상 함정 카탈로그). HWPX/PPTX를 한 글자라도 고치기 전, 문서 텍스트 추출 전에 반드시 전문 정독. Triggers - hwpx 편집, pptx 편집, 한글 문서, 파워포인트, 문서 손상, 텍스트 추출, docx, xlsx.
---

# work-rules-docs — 문서 파일 편집·추출 수칙

## 1. 문서 텍스트 추출 (docx·xlsx·hwpx·pptx → text, ★기본 절차)
- **추출 출력은 항상 UTF-8 파일로.** 이 환경은 한글 파일이 많고 Windows 콘솔은 cp949라, python 추출 결과를 stdout으로 바로 찍으면 한글/특수문자(예: `\xa9` ©)에서 UnicodeEncodeError로 추출 전체가 깨진다. `open(path,"w",encoding="utf-8").write(...)`로 파일에 쓴 뒤 Read 도구로 읽는다. 콘솔 직접 출력 금지.

## 2. HWPX 편집 (★어떤 hwpx 작업이든 시작 전 필독)
- **Rule 0 — linesegarray 전부 제거 (손상 오류의 압도적 1위 원인).** 텍스트를 한 글자라도 바꾸면 그 텍스트가 속한 섹션 XML 전체에서 모든 `<hp:linesegarray>`를 제거한다. 안 하면 한컴이 "문서가 손상되어 열 수 없음"으로 거부(반복 재발한 1위 함정). "편집한 문단만" 제거는 불충분 — 본문 문단 하나만 놓쳐도 손상 판정.
  - 문자열 치환: `re.sub(r"<hp:linesegarray>.*?</hp:linesegarray>","",d,flags=re.S)` + self-closing `<hp:linesegarray/>`도 제거 → 제거 후 XML 파싱 OK 확인.
  - lxml: live-tree 즉시 삭제는 형제를 건너뛴다 — 리스트를 먼저 materialize한 뒤 삭제.
  - 원리: linesegarray는 줄/글자 위치의 지오메트리 캐시. `<hp:t>` 길이가 바뀌면 캐시 인덱스가 범위를 벗어나 "손상" 판정. 한컴이 열 때 재계산하므로 제거는 무손실.
- **Rule 1 — 내장 이미지 교체 시 hashkey 삭제.** `Contents/content.hpf`의 `<opf:item>`에 있는 `hashkey="..."`(한컴 독자 해시)가 교체된 바이트와 불일치하면 "손상". 교체 이미지의 hashkey 속성을 통째로 삭제하면 검사를 건너뛰고 열린다. 교체 이미지는 원본과 정확히 같은 픽셀 치수로(프레임·왜곡 불변).
- **Rule 2 — CJK 정규식 문자클래스 금지.** `[一-鿿…]` 같은 범위는 경계 오류 시 한글(AC00-D7A3)까지 매칭해 본문을 지울 수 있다. CJK 매칭·치환은 리터럴 str.find/replace만 쓰고, 치환 전 `count == expected` 검증.
- **Rule 3 — 재패키징.** 원본 zip을 복사하고 변경된 엔트리만 교체(나머지 바이트·순서·compress_type 보존). `mimetype`은 첫 엔트리, STORED(`application/hwp+zip`). 본문 XML엔 BOM 없음, CR/LF 없음.
- **Rule 4 — 납품 전 검증.** ① 전 섹션/hpf XML 파싱 OK ② linesegarray 잔존 0 ③ mimetype 첫 엔트리 & STORED ④ zip testzip None ⑤ 미편집 `<hp:t>`가 원본과 동일 ⑥ 변경 엔트리 수가 의도와 일치.

## 3. PPTX 편집
- **"복구하시겠습니까?"는 경고지 오류가 아니다.** 복구/예를 누르면 정상적으로 열린다. "안 열림"으로 오독해 헛수고하지 말 것. 폰트 내장 덱은 원본 자체가 이 프롬프트를 띄울 수 있다 — 의심되면 원본과 바이트 diff로 "내 편집 탓 아님"부터 확인.
- **흔한 원인 = `[Content_Types].xml`의 `<Default xmlns="" .../>`.** `xmlns=""`가 Default를 OPC 네임스페이스 밖으로 빼내 스키마 위반 → 복구 트리거. `xmlns=""`만 제거하면 폰트 내장을 유지한 채 정리됨(제거는 선택).
- **진단 오라클 = .NET `System.IO.Packaging.Package.Open`(Add-Type WindowsBase).** PowerPoint COM은 이 환경에서 건강한 파일에도 무조건 실패(automation 차단)라 무용. python-pptx/zipfile/minidom은 너무 관대해 깨진 파일도 통과시킨다. OPC 레이어는 .NET OPC만 신뢰(단 슬라이드 PresentationML 스키마까지는 검사 안 함).
- **python-pptx 라운드트립은 내장 폰트(.fntdata)를 떨어뜨려 덱을 깨뜨린다** → 수동 ZIP/XML 주입 또는 새 파일만. 원본 compress_type 프로파일로 재압축(STORED면 STORED), external_attr와 date_time을 보존한 fresh ZipInfo 구성.
- 슬라이드 제거 시 `presentation.xml`의 sldIdLst 엔트리와 `presentation.xml.rels`의 rId를 둘 다 제거(안 하면 dangling). 기존 덮어쓰기 + 부족분만 추가가 제거보다 저위험.
- **진단 일반 원칙: 변수를 하나씩 바꿔 격리한다.** 여러 개를 한 번에 바꾸면 원인을 좁힐 수 없다.

## 4. 새 함정 발견 시
문서 파일 편집·추출 관련 신규 교훈은 실측 날짜와 함께 이 파일에 추가한다(실수 자기학습 규칙).
