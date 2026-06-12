---
name: new_hwpx_master
description: hwpx 공문/기안문 양식을 첨부하면 주제에 맞춰 공문 내용을 자동 작성
---

# HWPX 공문/기안문 자동 채우기 스킬

## 1단계: HWPX 파일 해제

```bash
mkdir -p hwpx_work && cd hwpx_work
cp 원본.hwpx 원본.zip
unzip -o 원본.zip -d original
```

해제 후 핵심 파일:
- Contents/section0.xml: 본문 (수정 대상)
- Contents/header.xml: 서식 정의
- mimetype, META-INF/, BinData/, Preview/: 수정하지 않음

---

## 2단계: section XML 구조 분석 (★ 반드시 실행)

단순히 텍스트를 순회하는 것이 아니라, **문단의 부모 구조(parent tag)** 를 함께 파악해야 한다.
한글 보고서 양식에서 본문 단락(□,○,―,※)은 흔히 **모든 섹션이 동일한 `<sec>` 요소의 직계 자식**으로 연결된다.
이 구조를 무시하면 섹션 경계 탐색이 실패하여 전체 본문이 삭제되는 치명적 오류가 발생한다.

```python
from lxml import etree

with open('original/Contents/section0.xml', 'rb') as f:
    tree = etree.parse(f)
root = tree.getroot()

# ★ sec 요소 찾기
sec_elem = None
for elem in root.iter():
    if etree.QName(elem.tag).localname == 'sec':
        sec_elem = elem
        break

# ★ sec 직계 자식 인덱스 맵핑 (구조 파악 필수)
sec_children = list(sec_elem)
print(f"sec 직계 자식 수: {len(sec_children)}")
for i, child in enumerate(sec_children):
    local = etree.QName(child.tag).localname
    if local == 'p':
        texts = [t.text for t in child.iter()
                 if etree.QName(t.tag).localname == 't' and t.text and t.text.strip()]
        if texts:
            print(f"sec_child[{i}] p: {'|'.join(texts)[:70]}")
    else:
        print(f"sec_child[{i}] {local}")
```

이 출력으로 **각 섹션 본문의 정확한 start/end 인덱스**를 확인한 뒤 다음 단계로 진행한다.

---

## 2.5단계: 수준(스타일) 규칙 — ★★★ 반드시 엄수 ★★★

**머리기호(◦ · - · ① · 1. · 가.)를 `<hp:t>` 텍스트에 직접 박지 마라.** 양식이 미리 정의해 둔 **수준 스타일** 을 적용하면, 머리기호·들여쓰기·자동번호는 **스타일이 알아서 부여**한다. 텍스트에 기호를 넣으면 "스타일을 적용한 게 아니라 흉내만 낸 것"이며, 스타일이 부여하는 기호와 겹쳐 `□ ◦ 내용`처럼 이중으로 찍힌다. (실제 지적 사례: 본문을 일반 단락 `paraPr=일반` 에 `◦`를 텍스트로 넣어 만들었다가 "내가 정의해둔 스타일을 적용하라"고 반려됨.)

### ★ 0순위 — `styleIDRef`(스타일)를 적용하라. `paraPrIDRef`만 바꾸면 가짜다.
HWPX 단락은 **`styleIDRef`(한컴 "스타일" 시스템)** 와 **`paraPrIDRef`(문단 모양)** 를 **둘 다** 가진다. `paraPrIDRef`만 수준에 맞게 바꾸고 `styleIDRef="0"`(바탕글)로 두면 — 모양은 비슷해 보여도 **한컴에서 단락을 클릭하면 전부 "바탕글"로 표시되는 가짜 적용**이다. (실제 반려 사례: "어떤 글이든 클릭하면 전부 바탕글이다. 가짜다.")
- **반드시 `styleIDRef`를 양식의 수준 스타일 id로 지정**하고, 그 스타일이 가리키는 `paraPrIDRef`·`charPrIDRef`를 함께 일치시킨다.
- 양식 빈 슬롯(본문 자리의 빈 `<hp:p>`)의 `styleIDRef`가 양식 제작자가 의도한 수준 스타일이라는 **결정적 단서**다. 거기에 적힌 styleIDRef를 그대로 써라.

### ★ 스타일 테이블 추출 (header.xml `<hh:style>`)
```python
for st in [e for e in r.iter() if ln(e)=='style']:
    print(st.get('id'), st.get('name'), 'paraPr=', st.get('paraPrIDRef'), 'charPr=', st.get('charPrIDRef'))
```
한국 공문 양식의 전형적 스타일 테이블 예 (이 프로젝트 결과보고서 양식 실측):
```
id=0  바탕글       paraPr=4
id=1  □ 수준 1     paraPr=44 charPr=30
id=2  ◯ 수준 2     paraPr=45 charPr=32
id=3  - 수준 3     paraPr=46 charPr=32
id=4  ∙ 수준 4     paraPr=63 charPr=35
id=5  수준 5       paraPr=64 charPr=29
id=7~13 개요 1~7   paraPr=5,10~15
```
→ 본문 수준 1~4 단락 = `styleIDRef="1|2|3|4"` + 동일 `paraPrIDRef`/`charPrIDRef`. 대제목·중제목은 양식이 바탕글(style 0)+큰 charPr로 두는 경우가 많으니 양식 원본을 따른다.

```python
def make_level(text, lvl):           # lvl: 1~4
    p = deepcopy(template_p)
    p.set('styleIDRef', STYLE[lvl])  # ★ 핵심 — 스타일 실제 적용
    p.set('paraPrIDRef', PARA[lvl])
    set_run_text(p, text, CHAR[lvl]) # 텍스트엔 머리기호 없이 순수 내용만
    return p
```

### ★ 구분자(: / － ·)로 정보를 묶지 마라 — 수준으로 분해
"레이블: 설명", "A / B / C 나열", "항목 － 부연"을 한 줄에 넣는 것은 **수준 분리를 안 한 것**이다(반려 사례: "왜 자꾸 구분자를 쓰냐, 수준을 쓰면 되는데"). 각 정보를 별도 하위 수준 단락으로 펼쳐라.
- 예외(분해 금지): 모델명 `VAR/VECM`·`IF/LOF/OC-SVM`, 전달경로 `A→B→E`, 수치범위 `2/3/6개월`·`±3%`, 날짜·URL·표 셀 내부.

### ① 작업 전 — 양식이 정의한 수준 체계를 header.xml에서 파악 (필수)
`Contents/header.xml` 에서 세 가지를 추출한다.
- **paraPr별 heading**: 각 `<hh:paraPr id=…>` 의 자식 `<hh:heading type="OUTLINE|BULLET|NONE" level="N" idRef="M"/>`. → 어느 paraPr이 몇 수준(level)이고 OUTLINE(번호)인지 BULLET(글머리표)인지 매핑.
- **numbering 정의**(OUTLINE용): `<hh:numbering>` 의 `<hh:paraHead level fmt text>`. 한국 공문 표준 예시:
  `lvl1 DIGIT "^1."`(1.) · `lvl2 HANGUL_SYLLABLE "^2."`(가.) · `lvl3 "^3)"`(1)) · `lvl4 "^4)"`(가)) · `lvl5 "(^5)"`((1)) · `lvl6 "(^6)"`((가)) · `lvl7 CIRCLED_DIGIT`(①)
- **bullet 정의**(BULLET용): `<hh:bullet id char>`. 예: `1=□ · 2=○ · 3=－ · 5=◦`. (※ ``·`` 등은 심볼폰트 글머리표.)

```python
for pp in [e for e in r.iter() if ln(e)=='paraPr']:
    h = next((c for c in pp if ln(c)=='heading'), None)
    if h is not None and h.get('type') != 'NONE':
        print(pp.get('id'), h.get('type'), 'lvl', h.get('level'), 'idRef', h.get('idRef'))
```

### ② 본문 깊이 → 양식 수준 매핑표를 만들고 그대로 적용
원고(마크다운 등)의 논리적 깊이를 양식 수준 paraPr에 1:1로 매핑한 뒤, **텍스트에서는 머리기호/번호를 정규식으로 제거**하고 `paraPrIDRef` 만 지정한다. (OUTLINE 개요번호 예시)

| 본문 깊이 | 양식 수준 | paraPrIDRef | 자동 부여 |
|-----------|-----------|-------------|-----------|
| 대제목 `N.` | 수준1 | (해당 paraPr) | `1.` |
| 중제목 `가.` | 수준2 | … | `가.` |
| 본문 1수준 | 수준3 | … | `1)` |
| 본문 2수준 | 수준4 | … | `가)` |
| 본문 3수준 | 수준5 | … | `(1)` |

```python
def strip_marker(s):  # 스타일이 자동 부여하므로 원고의 기호/번호는 제거
    s = s.strip()
    for pat in (r'^[◦\-–—－·•]\s*', r'^[①-⑳]\s*', r'^\(\s*\d+\s*\)\s*',
                r'^\(\s*[가-힣]\s*\)\s*', r'^\d+\)\s*', r'^[가-힣]\)\s*',
                r'^\d+\.\s*', r'^[가-힣]\.\s*'):
        s = re.sub(pat, '', s)
    return s.strip()
```

- 어느 체계(OUTLINE 번호 vs BULLET 글머리표)를 쓸지 **원고/사용자 의도와 양식 빈 슬롯의 paraPr을 보고 결정**한다. 빈 슬롯(본문 자리에 미리 깔린 빈 `<hp:p>`)의 `paraPrIDRef` = 양식 제작자가 의도한 본문 스타일이라는 강력한 단서.
- 정의만 있고 본문에서 안 쓰인 paraPr(예: OUTLINE 10~15)도 `paraPrIDRef` 로 지정하면 유효하게 적용된다(header에 정의가 있으면 됨).
- charPr(글자모양)은 수준별로 별도 지정(제목은 큰 글씨, 본문은 작은 글씨). paraPr이 글자크기까지 강제하지는 않는다.

---

## 3단계: XML 수정

### ★★★ 가장 중요한 규칙: linesegarray 삭제 ★★★

텍스트를 수정한 `<hp:p>` 에서 반드시 `<linesegarray>` 자식 요소를 삭제해야 한다.

linesegarray는 원본 편집기가 저장한 "줄 배치 캐시"이다.
텍스트를 변경하면 이 캐시가 무효화되어 글자가 겹쳐 보이는 현상이 발생한다.
삭제하면 한컴오피스가 파일을 열 때 자동으로 줄 배치를 재계산한다.

```python
def remove_linesegarray(p_element):
    """수정된 문단에서 linesegarray를 삭제한다. 필수!"""
    for child in list(p_element):
        if etree.QName(child.tag).localname == 'linesegarray':
            p_element.remove(child)
```

### 절대 금지 사항

- 절대로 XML을 문자열(f-string, concat, replace)로 조합하지 않는다.
- 절대로 XML 선언(<?xml ...?>)을 수동으로 추가하지 않는다.
- 절대로 section0.xml 전체를 새로 작성하지 않는다.
- 절대로 .replace()나 re.sub()로 XML을 조작하지 않는다.
- **절대로 텍스트 내용으로 섹션 경계를 탐색하지 않는다 → 2단계의 인덱스 맵핑을 사용한다.**

---

## 4단계: 섹션 본문 교체 (★★★ sec 공유 구조 대응)

### 핵심 헬퍼 함수

```python
import copy

def clone_para(ref_p, run_texts):
    """
    ref_p를 깊은 복사하여 각 run의 텍스트를 교체.
    run_texts: ['run0에 넣을 텍스트', 'run1에 넣을 텍스트', ...]
    여분의 run은 제거. linesegarray 삭제 필수.
    """
    new_p = copy.deepcopy(ref_p)
    remove_linesegarray(new_p)
    runs = [c for c in new_p if etree.QName(c.tag).localname == 'run']
    for i, txt in enumerate(run_texts):
        if i < len(runs):
            for t in runs[i]:
                if etree.QName(t.tag).localname == 't':
                    t.text = txt
                    break
    for r in runs[len(run_texts):]:
        new_p.remove(r)
    return new_p


def replace_section_body(sec_elem, body_start_idx, body_end_idx,
                          ref_box, ref_circle, ref_dash, ref_note,
                          content_list):
    """
    sec_elem      : 모든 본문 단락의 공통 부모 sec 요소
    body_start_idx: 교체 시작 자식 인덱스 (첫 □ 위치)
    body_end_idx  : 교체 끝 자식 인덱스 + 1 (exclusive)
    ref_box       : □ 두 run 구조 참조 단락 (deepcopy 원본)
    ref_circle    : ○ 단락 참조
    ref_dash      : ― 단락 참조
    ref_note      : ※ 단락 참조
    content_list  : [("box"|"circle"|"dash"|"note", "텍스트"), ...]
    """
    to_remove = list(sec_elem)[body_start_idx:body_end_idx]
    for child in to_remove:
        sec_elem.remove(child)

    sym_map = {
        "box":    (" □  ", True),
        "circle": ("  ○ ", False),
        "dash":   ("   ― ", False),
        "note":   ("     ※ ", False),
    }
    ref_map = {
        "box": ref_box, "circle": ref_circle,
        "dash": ref_dash, "note": ref_note,
    }

    insert_pos = body_start_idx
    for typ, text in content_list:
        sym, two_run = sym_map[typ]
        ref_p = ref_map[typ]
        if two_run:
            new_p = clone_para(ref_p, [sym, text])
        else:
            new_p = clone_para(ref_p, [sym + text])
        sec_elem.insert(insert_pos, new_p)
        insert_pos += 1
```

### ★★★ 반드시 역순(Ⅳ→Ⅲ→Ⅱ→Ⅰ)으로 처리

여러 섹션을 순서대로(Ⅰ→Ⅱ→...) 처리하면 삽입/삭제로 인해 이후 섹션 인덱스가 틀어진다.
**반드시 마지막 섹션부터 역순으로 호출한다.**

```python
# 2단계 출력으로 확인한 실제 인덱스를 아래에 입력
# 참조 단락은 수정 전에 반드시 deepcopy로 저장
sec_children = list(sec_elem)
ref_box    = copy.deepcopy(sec_children[23])  # □ 두 run 구조 (실제 인덱스로 교체)
ref_circle = copy.deepcopy(sec_children[24])  # ○
ref_dash   = copy.deepcopy(sec_children[25])  # ―
ref_note   = copy.deepcopy(sec_children[31])  # ※ (있는 섹션에서 가져옴)

# ★ 역순 처리 (Ⅳ → Ⅲ → Ⅱ → Ⅰ)
replace_section_body(sec_elem, sec4_start, sec4_end, ref_box, ref_circle, ref_dash, ref_note, sec4_content)
replace_section_body(sec_elem, sec3_start, sec3_end, ref_box, ref_circle, ref_dash, ref_note, sec3_content)
replace_section_body(sec_elem, sec2_start, sec2_end, ref_box, ref_circle, ref_dash, ref_note, sec2_content)
replace_section_body(sec_elem, sec1_start, sec1_end, ref_box, ref_circle, ref_dash, ref_note, sec1_content)
```

> **순서 처리가 불가피한 경우**: 각 호출 후 `delta = len(content) - (end - start)`를 계산하여
> 이후 섹션 인덱스에 누적 합산한다.

---

## 5단계: 단순 텍스트 교체 (제목·날짜·기관명 등)

```python
def set_run_text(p_elem, run_idx, new_text, remove_extra_runs=False):
    """p_elem의 run_idx번째 run에 텍스트 설정. linesegarray 삭제."""
    runs = [c for c in p_elem if etree.QName(c.tag).localname == 'run']
    if run_idx < len(runs):
        for t in runs[run_idx]:
            if etree.QName(t.tag).localname == 't':
                t.text = new_text
                break
    if remove_extra_runs:
        for r in runs[run_idx+1:]:
            p_elem.remove(r)
    remove_linesegarray(p_elem)

# 사용 예 (인덱스는 2단계 출력으로 확인)
set_run_text(sec_children[5],  0, "보고서 제목", remove_extra_runs=True)
set_run_text(sec_children[11], 0, "2026. 7. 1.")
set_run_text(sec_children[16], 0, "기관명")
```

subList/tc 내부 단락(섹션 번호 사이드바 등)도 동일하게 처리한다.

---

## 6단계: XML 저장

```python
enc = tree.docinfo.encoding or 'UTF-8'
sa  = tree.docinfo.standalone
tree.write('original/Contents/section0.xml',
           xml_declaration=True,
           encoding=enc,
           standalone=sa)
```

---

## 7단계: HWPX 재패키징

```python
import zipfile, os

output_path = '결과물.hwpx'
with zipfile.ZipFile(output_path, 'w') as zf:
    mimetype_path = os.path.join('original', 'mimetype')
    if os.path.exists(mimetype_path):
        zf.write(mimetype_path, 'mimetype', compress_type=zipfile.ZIP_STORED)
    for dirpath, dirnames, filenames in os.walk('original'):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            arcname  = os.path.relpath(filepath, 'original')
            if arcname == 'mimetype':
                continue
            zf.write(filepath, arcname, compress_type=zipfile.ZIP_DEFLATED)
```

---

## 8단계: 검증

```python
with zipfile.ZipFile(output_path, 'r') as zf:
    assert zf.testzip() is None, "ZIP 손상"
    with zf.open('Contents/section0.xml') as f:
        tree = etree.parse(f)
print("검증 완료")
```

---

## 9단계: 공문 작성 원칙

- 경어체 (합니다/습니다체)
- 두괄식 서술 (결론 → 배경 → 세부내용)
- 본문 순서: 목적/배경 → 세부 내용 → 요청/협조 사항 → 붙임
- 관용 표현: "~와 관련하여", "아래와 같이", "~하여 주시기 바랍니다"

---

## ★ 작업 체크리스트

| 순서 | 확인 항목 |
|------|-----------|
| ① | 2단계 구조 분석 실행 → `sec` 직계 자식 인덱스 맵 출력 확인 |
| ② | 참조 단락(`ref_box`, `ref_circle`, `ref_dash`, `ref_note`)을 수정 전에 `deepcopy`로 저장 |
| ③ | 섹션 본문 교체는 **역순(마지막 섹션부터)** 으로 처리 |
| ④ | 텍스트를 수정한 모든 `<hp:p>`에서 `linesegarray` 삭제 확인 |
| ⑤ | `mimetype` 비압축 첫 번째 삽입 확인 |
| ⑥ | 최종 ZIP 검증 통과 확인 |
