---
name: new-hwpx-master
description: Fill a Korean hwpx official-document or draft template with content generated for a given topic - unpack, map the section XML structure, apply the template's level styles via styleIDRef, replace section bodies in reverse order, repackage and verify. Use when an hwpx form is supplied and its body has to be written. Triggers - hwpx 공문, 기안문, 양식 채우기, hwpx 자동 작성, official document template.
---

# new-hwpx-master — filling an hwpx official-document template

Rules: HX-1..HX-16 (16).
The general corruption rules for hwpx live in `work-rules-docs` DC-2..DC-6 and also apply here. This file is the end-to-end procedure.
Body text produced by this skill is Korean (CLAUDE.md G-01); this procedure is instruction, so it is English.

## Step 1 — unpack the hwpx

```bash
mkdir -p hwpx_work && cd hwpx_work
cp 원본.hwpx 원본.zip
unzip -o 원본.zip -d original
```

Files that matter after unpacking:
- `Contents/section0.xml` — the body, the edit target
- `Contents/header.xml` — style definitions
- `mimetype`, `META-INF/`, `BinData/`, `Preview/` — never modified

## Step 2 — map the section XML structure (mandatory)

**HX-1 Do not simply walk the text; establish each paragraph's parent structure.** In Korean report templates the body paragraphs (□, ○, ―, ※) are commonly all **direct children of the same `<sec>` element**. Ignoring this makes section-boundary detection fail, and the failure mode is deleting the entire body.

```python
from lxml import etree

with open('original/Contents/section0.xml', 'rb') as f:
    tree = etree.parse(f)
root = tree.getroot()

# find the sec element
sec_elem = None
for elem in root.iter():
    if etree.QName(elem.tag).localname == 'sec':
        sec_elem = elem
        break

# map the direct children of sec by index - required to understand the structure
sec_children = list(sec_elem)
print(f"sec direct children: {len(sec_children)}")
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

Confirm the exact start and end index of each section body from this output before going further.

## Step 3 — level styles (the rule most often violated)

**HX-2 Never put a bullet marker (◦, ·, -, ①, 1., 가.) into `<hp:t>` text.** Apply the **level style** the template already defines and the marker, indentation and automatic numbering come from the style. Putting the symbol in the text is imitating a style rather than applying one, and it collides with the style's own marker to print `□ ◦ 내용`. Rejected in practice: body paragraphs were built as ordinary `paraPr=일반` paragraphs with a literal `◦`, and the user's response was "내가 정의해둔 스타일을 적용하라".

### HX-3 Apply `styleIDRef`. Changing only `paraPrIDRef` is fake

An HWPX paragraph carries **both** `styleIDRef` (Hangul's "style" system) and `paraPrIDRef` (paragraph shape). Setting only `paraPrIDRef` to the right level while leaving `styleIDRef="0"` (바탕글) looks approximately right but **every paragraph reports as 바탕글 when clicked in Hangul** — a fake application. Rejected in practice with: "어떤 글이든 클릭하면 전부 바탕글이다. 가짜다."

- Set `styleIDRef` to the template's level style id, and match the `paraPrIDRef` and `charPrIDRef` that style points at.
- **The decisive clue** is the `styleIDRef` on the template's empty slots — the empty `<hp:p>` elements sitting where the body goes. That is the level style the template's author intended. Use it as-is.

### Extract the style table (`header.xml` `<hh:style>`)

```python
for st in [e for e in r.iter() if ln(e) == 'style']:
    print(st.get('id'), st.get('name'), 'paraPr=', st.get('paraPrIDRef'), 'charPr=', st.get('charPrIDRef'))
```

A typical Korean official-document style table, measured on this project's report template:

```
id=0  바탕글       paraPr=4
id=1  □ 수준 1     paraPr=44 charPr=30
id=2  ◯ 수준 2     paraPr=45 charPr=32
id=3  - 수준 3     paraPr=46 charPr=32
id=4  ∙ 수준 4     paraPr=63 charPr=35
id=5  수준 5       paraPr=64 charPr=29
id=7~13 개요 1~7   paraPr=5,10~15
```

So body levels 1-4 are `styleIDRef="1|2|3|4"` with the matching `paraPrIDRef` and `charPrIDRef`. Main and mid headings are often left as 바탕글 (style 0) with a large charPr by the template — follow the original template.

```python
def make_level(text, lvl):            # lvl: 1-4
    p = deepcopy(template_p)
    p.set('styleIDRef', STYLE[lvl])   # the essential line - actually applies the style
    p.set('paraPrIDRef', PARA[lvl])
    set_run_text(p, text, CHAR[lvl])  # text carries content only, no marker
    return p
```

### HX-4 Do not bundle information with separators — decompose into levels

Putting "레이블: 설명", "A / B / C" or "항목 － 부연" on one line means the levels were not separated. Rejected in practice with: "왜 자꾸 구분자를 쓰냐, 수준을 쓰면 되는데". Expand each piece into its own sub-level paragraph.

Exceptions that must not be decomposed: model names (`VAR/VECM`, `IF/LOF/OC-SVM`), transmission paths (`A→B→E`), numeric ranges (`2/3/6개월`, `±3%`), dates, URLs, and text inside table cells.

### HX-5 Read the template's level system out of header.xml before starting

Extract three things from `Contents/header.xml`:

- **heading per paraPr** — the `<hh:heading type="OUTLINE|BULLET|NONE" level="N" idRef="M"/>` child of each `<hh:paraPr id=…>`. This maps which paraPr is which level, and whether it is OUTLINE (numbered) or BULLET.
- **numbering definitions** (for OUTLINE) — `<hh:paraHead level fmt text>` inside `<hh:numbering>`. The Korean official-document standard: `lvl1 DIGIT "^1."` (1.), `lvl2 HANGUL_SYLLABLE "^2."` (가.), `lvl3 "^3)"` (1)), `lvl4 "^4)"` (가)), `lvl5 "(^5)"` ((1)), `lvl6 "(^6)"` ((가)), `lvl7 CIRCLED_DIGIT` (①).
- **bullet definitions** (for BULLET) — `<hh:bullet id char>`, for example `1=□`, `2=○`, `3=－`, `5=◦`. Some are symbol-font bullets.

```python
for pp in [e for e in r.iter() if ln(e) == 'paraPr']:
    h = next((c for c in pp if ln(c) == 'heading'), None)
    if h is not None and h.get('type') != 'NONE':
        print(pp.get('id'), h.get('type'), 'lvl', h.get('level'), 'idRef', h.get('idRef'))
```

### HX-6 Build a depth-to-level mapping table and apply it literally

Map the logical depth of the source text (markdown or similar) one-to-one onto the template's levels, **strip the markers and numbers from the text with a regex**, and set only `paraPrIDRef`. Example for OUTLINE numbering:

| Source depth | Template level | paraPrIDRef | Auto-applied |
|---|---|---|---|
| Main heading `N.` | 수준1 | (that paraPr) | `1.` |
| Mid heading `가.` | 수준2 | … | `가.` |
| Body level 1 | 수준3 | … | `1)` |
| Body level 2 | 수준4 | … | `가)` |
| Body level 3 | 수준5 | … | `(1)` |

```python
def strip_marker(s):  # the style applies markers, so remove them from the source
    s = s.strip()
    for pat in (r'^[◦\-–—－·•]\s*', r'^[①-⑳]\s*', r'^\(\s*\d+\s*\)\s*',
                r'^\(\s*[가-힣]\s*\)\s*', r'^\d+\)\s*', r'^[가-힣]\)\s*',
                r'^\d+\.\s*', r'^[가-힣]\.\s*'):
        s = re.sub(pat, '', s)
    return s.strip()
```

- Decide between OUTLINE numbering and BULLET markers from the source and the user's intent **plus the paraPr on the template's empty slots** — the strongest available clue to what the template's author intended.
- A paraPr that is defined but unused in the body (OUTLINE 10-15, for instance) still applies correctly when set as `paraPrIDRef`. A definition in header.xml is enough.
- Set charPr separately per level (large for headings, small for body). paraPr does not force the font size.

## Step 4 — modify the XML

### HX-7 Delete `linesegarray` — the single most important rule

Every `<hp:p>` whose text was modified must have its `<linesegarray>` child removed. It is the line-layout cache saved by the original editor; changing the text invalidates it and characters render overlapping. Removing it makes Hangul recompute the layout on open, so removal is lossless. Full rationale in `work-rules-docs` DC-2, which also requires removing them across the **whole** section, not only the edited paragraphs.

```python
def remove_linesegarray(p_element):
    """Remove linesegarray from a modified paragraph. Mandatory."""
    for child in list(p_element):
        if etree.QName(child.tag).localname == 'linesegarray':
            p_element.remove(child)
```

### HX-8 Absolute prohibitions

- Never assemble XML as a string (f-string, concatenation, replace).
- Never add the XML declaration (`<?xml ...?>`) by hand.
- Never rewrite the whole of `section0.xml`.
- Never manipulate XML with `.replace()` or `re.sub()`.
- **Never locate section boundaries by text content** — use the index map from step 2.

## Step 5 — replace section bodies (shared `sec` structure)

```python
import copy

def clone_para(ref_p, run_texts):
    """
    Deep-copy ref_p and replace each run's text.
    run_texts: ['text for run0', 'text for run1', ...]
    Surplus runs are removed. Removing linesegarray is mandatory.
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
    sec_elem       : the shared parent sec element of every body paragraph
    body_start_idx : first child index to replace (position of the first □)
    body_end_idx   : last child index + 1 (exclusive)
    ref_box        : reference paragraph for □ (two-run structure), kept as a deepcopy
    ref_circle     : reference paragraph for ○
    ref_dash       : reference paragraph for ―
    ref_note       : reference paragraph for ※
    content_list   : [("box"|"circle"|"dash"|"note", "text"), ...]
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

### HX-9 Process sections in reverse order (Ⅳ → Ⅲ → Ⅱ → Ⅰ)

Processing forward (Ⅰ → Ⅱ → …) shifts every later section's indices as paragraphs are inserted and deleted. **Always call from the last section backwards.**

```python
# fill in the actual indices confirmed from the step 2 output
# reference paragraphs must be deepcopy'd before any modification
sec_children = list(sec_elem)
ref_box    = copy.deepcopy(sec_children[23])  # □, two-run structure (use the real index)
ref_circle = copy.deepcopy(sec_children[24])  # ○
ref_dash   = copy.deepcopy(sec_children[25])  # ―
ref_note   = copy.deepcopy(sec_children[31])  # ※ (taken from a section that has one)

# reverse order
replace_section_body(sec_elem, sec4_start, sec4_end, ref_box, ref_circle, ref_dash, ref_note, sec4_content)
replace_section_body(sec_elem, sec3_start, sec3_end, ref_box, ref_circle, ref_dash, ref_note, sec3_content)
replace_section_body(sec_elem, sec2_start, sec2_end, ref_box, ref_circle, ref_dash, ref_note, sec2_content)
replace_section_body(sec_elem, sec1_start, sec1_end, ref_box, ref_circle, ref_dash, ref_note, sec1_content)
```

> If forward processing is unavoidable, compute `delta = len(content) - (end - start)` after each call and add it cumulatively to every later section's indices.

## Step 6 — simple text replacement (title, date, organization)

```python
def set_run_text(p_elem, run_idx, new_text, remove_extra_runs=False):
    """Set the text of run_idx in p_elem. Removes linesegarray."""
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

# usage - indices come from the step 2 output
set_run_text(sec_children[5],  0, "보고서 제목", remove_extra_runs=True)
set_run_text(sec_children[11], 0, "2026. 7. 1.")
set_run_text(sec_children[16], 0, "기관명")
```

Paragraphs inside `subList` / `tc` (the section-number sidebar and similar) are handled the same way.

## Step 7 — save the XML

```python
enc = tree.docinfo.encoding or 'UTF-8'
sa  = tree.docinfo.standalone
tree.write('original/Contents/section0.xml',
           xml_declaration=True,
           encoding=enc,
           standalone=sa)
```

## Step 8 — repackage

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

## Step 9 — verify

```python
with zipfile.ZipFile(output_path, 'r') as zf:
    assert zf.testzip() is None, "ZIP corrupt"
    with zf.open('Contents/section0.xml') as f:
        tree = etree.parse(f)
print("verification passed")
```

Run the full `work-rules-docs` DC-6 checklist as well, not only this one.

## HX-10 Writing conventions for the body

The body is Korean official-document prose:

- 경어체 (합니다 / 습니다).
- Conclusion first, then background, then detail.
- Body order: 목적·배경 → 세부 내용 → 요청·협조 사항 → 붙임.
- Standard phrasing: "~와 관련하여", "아래와 같이", "~하여 주시기 바랍니다".

Punctuation and AI-tell rules from `work-rules-writing` WR-2..WR-4 apply to this text.

## HX-11 Checklist

| # | Check |
|---|---|
| 1 | Step 2 structure analysis run; `sec` direct-child index map confirmed |
| 2 | Reference paragraphs (`ref_box`, `ref_circle`, `ref_dash`, `ref_note`) deepcopy'd before any modification |
| 3 | Section bodies replaced in reverse order, last section first |
| 4 | `linesegarray` removed from every modified `<hp:p>`, and across the whole section |
| 5 | `styleIDRef` actually set to the template's level style, not only `paraPrIDRef` |
| 6 | `mimetype` inserted first and uncompressed |
| 7 | Final ZIP verification passed |

## Filling a form rather than a body — tables, pictures, page fit

Official *forms* (지출 결과서, 검수확인서) are tables end to end, so HX-2..HX-6 do not apply — a table cell is an explicit exception in HX-4. Measured procedure for that shape, 2026-08-01.

**HX-13 Address cells by `cellAddr`, and replace the template's grey example styles.** Build `(rowAddr, colAddr) -> tc` from each `hp:tbl` and edit through that map, never by text search (HX-8). Korean forms ship pre-filled examples in a light italic charPr (`textColor` `#BFBFBF` / `#D9D9D9`, `italic`, `bold`); reuse those cells verbatim and real data prints as a watermark. Map each example charPr to the **black charPr of the same `height`** already in `header.xml` — never invent one. The empty cells name the intended normal style, as empty slots do for level styles in HX-3.

- A stray Hangul memo hides in the run as `<hp:ctrl><hp:fieldBegin type="MEMO">` around the cell text and never shows in `PrvText`. Strip `fieldBegin` / `fieldEnd` ctrls, assert `"MEMO" not in body`.

**HX-14 Embedding a picture takes three coordinated changes, and the units are not obvious.** Add the bytes as `BinData/imageN.png`, add `<opf:item id="imageN" href="BinData/imageN.png" media-type="image/png" isEmbeded="1"/>` to `Contents/content.hpf`, and place an `<hp:pic>` in a run. Clone an existing `hp:pic` rather than authoring one (HX-8), then patch it:

| Element | Value |
|---|---|
| `hp:imgDim`, `hp:imgClip` | pixels × **75** (HWPUNIT at 96 dpi), clip from 0 |
| `hp:orgSz`, `hp:imgRect` pt0-pt3 | the *source* image's pixels × 75 |
| `hp:curSz`, `hp:sz` | displayed size |
| `hc:scaMatrix` e1 / e5 | `curSz / orgSz` |
| `hp:rotationInfo` centerX / centerY | `curSz / 2` |
| `hc:img` | **reset `bright="0" contrast="0" effect="REAL_PIC"`** |

Sample pictures carry `bright="50" contrast="-50" effect="GRAY_SCALE"` — the washed-out placeholder look; copy it onto real evidence and it prints as a grey ghost. Give every new pic a unique `id` and `instid`, and drop the inherited `hp:shapeComment` (it still describes the sample). Verify by set inclusion: every `binaryItemIDRef` must appear in both the hpf manifest and the zip. `hashkey` (DC-3) is absent on many templates — check before assuming it needs deleting.

- An inline picture is capped by its **cell width**, not by the height you ask for. A stamp in a 3685-HWPUNIT `(인)` cell scaled to 9 mm and read as a smudge; the same image in the 10477-wide name cell beside it was legible. Measure `cellSz` before choosing the fit box.
- Phone photos carry a real EXIF `Orientation` (6 / 8). `ImageOps.exif_transpose` alone is correct — a following "force landscape" pass undoes it and lays every portrait photo back on its side. Verify on a contact sheet, not by reasoning about the tag.

**HX-15 Page fit is arithmetic; shrinking a font inside a narrow column does not help.** In a fixed-width column the block's height is roughly conserved — a smaller font just wraps to more lines. Measured: a 26-character note at 10 pt in a 16.2 mm column was five lines, and 8 pt was no shorter. What works, in order:

1. **Delete unused table rows.** Renumber every later `cellAddr`, drop `rowCnt`, reduce the table's `hp:sz` height. Assert first that no dropped row is spanned (`rowSpan != 1`) and all its cells are empty, then read back known labels at their new addresses to prove the renumbering held.
2. **Trim decorative row heights** (`cellSz height`) in signature blocks, leaving rows that receive a stamp alone.
3. **Remove empty spacer paragraphs** between a heading and its table — usually the last few millimetres.

Diagnose before prescribing: export to PDF (`work-rules-docs` DC-15) and measure the block against the usable text area. A table pushed to its own page is almost never a stray `pageBreak` — check `breakSetting/@pageBreakBefore` once to rule it out, then do the subtraction.

**HX-16 A new outline level needs its own named style, never a paraPr override on a shared one (measured 2026-08-02).** This is HX-3 taken to its end: HX-3 says set a real `styleIDRef`, not just `paraPrIDRef`; HX-16 says that "real style" must be **distinct per level**. When the template ships fewer level styles than your outline needs — e.g. a 4-level 개조식 on a form that defines only `라벨` and `소본문` — **create one `<hh:style>` per new level**, do not reuse one existing style for several visually-different levels.

- Per level: clone an existing `<hh:style>`, give it a distinct `id` / `name` / `engName`, point `paraPrIDRef` at a per-level paraPr (its own bullet `idRef` + graded `margin/left`, cloned per HX-8) and `charPrIDRef` at the intended char; append to the `styles` container and bump its `itemCnt`. Add any new bullet to the `bullets` container the same way (clone, change `id` and `char`, bump `itemCnt`). Indent ladder that worked: `margin/left` 3700 / 4400 / 5100 HWPUNIT for levels 2-4 with the `case` value at half.
- Then set each paragraph's `styleIDRef` to its level's new style, with `paraPrIDRef` and `charPrIDRef` matching that style (HX-3). Identify the paragraphs to remap by their per-level `paraPrIDRef`, which is unique to the level.
- Failure mode this fixes: three distinct levels all on `styleIDRef="4"` (소본문) with only `paraPrIDRef` differing. Every level then reports as **소본문** in F6 — the user cannot select or restyle a level, and the editor's style system is bypassed. Rejected with "편집기 스타일 시스템을 사용하지 않았다 … 각 레벨 스타일을 생성해서 재적용하라". The fix was header-only (add styles 중점/소점/세부 to the `styles` container + remap 426 paragraphs' `styleIDRef`), no content regeneration — so getting this wrong is cheap to correct **if** the level→paraPr mapping was clean, which is a further reason to give each level its own paraPr from the start.

## HX-12 New lessons

Add hwpx template lessons here with the measured date and update the rule count. A trap that belongs to the hwpx format in general, rather than to filling a template, goes to `work-rules-docs` instead.
