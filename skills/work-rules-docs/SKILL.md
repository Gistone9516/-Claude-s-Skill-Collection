---
name: work-rules-docs
description: Editing and extracting document files (hwpx, pptx, docx, xlsx) - a catalogue of measured corruption traps and the validated procedure for each. Read in full before changing a single character of an hwpx or pptx, and before extracting text from any document file. Triggers - hwpx 편집, pptx 편집, 한글 문서, 파워포인트, 문서 손상, 텍스트 추출, docx, xlsx.
---

# work-rules-docs — document file editing and extraction

Rules: DC-1..DC-14 (14).
For filling an hwpx official-document template end to end, use `new-hwpx-master`; this file holds the corruption rules that apply to any document work.

## 1. Extracting text (docx, xlsx, hwpx, pptx)

**DC-1 Always write extraction output to a UTF-8 file.** This environment is full of Korean files and the Windows console is cp949, so printing a Python extraction straight to stdout kills the whole extraction with `UnicodeEncodeError` on Korean or a special character such as `\xa9` (©). Write with `open(path, "w", encoding="utf-8")` and read the file back with the Read tool. Never print to the console directly.

## 2. Editing hwpx

**DC-2 Rule 0 — remove every `linesegarray`.** This is by a wide margin the most common cause of corruption. Change a single character of text and you must remove **all** `<hp:linesegarray>` elements from the entire section XML that text belongs to. Skip it and Hangul refuses the file with "문서가 손상되어 열 수 없음" — the trap that recurred most often. Removing only "the paragraphs I edited" is not enough; missing one body paragraph is enough to trigger the corruption verdict.

- String substitution: `re.sub(r"<hp:linesegarray>.*?</hp:linesegarray>", "", d, flags=re.S)`, plus the self-closing `<hp:linesegarray/>`. Confirm the XML still parses afterwards.
- With lxml, deleting from a live tree skips siblings — materialize the list first, then delete.
- Why it is safe: `linesegarray` is a geometry cache of line and character positions. When the length of `<hp:t>` changes, the cache indices fall out of range and the file is judged corrupt. Hangul recomputes it on open, so removal is lossless.

**DC-3 Rule 1 — delete the hashkey when replacing an embedded image.** The `hashkey="..."` attribute on `<opf:item>` in `Contents/content.hpf` is a Hangul-proprietary hash; if it disagrees with the replaced bytes the file is corrupt. Deleting the attribute entirely on the replaced image skips the check and the file opens. Replacement images must have exactly the original pixel dimensions so frames and proportions are unchanged.

**DC-4 Rule 2 — no CJK regex character classes.** A range like `[一-鿿…]` can, on a boundary error, match Hangul (AC00-D7A3) and erase body text. Match and replace CJK with literal `str.find` / `str.replace` only, and verify `count == expected` before substituting.

**DC-5 Rule 3 — repackaging.** Copy the original zip and replace only the changed entries, preserving the remaining bytes, their order and their `compress_type`. `mimetype` is the first entry, STORED, `application/hwp+zip`. Body XML has no BOM and no CR/LF.

**DC-6 Rule 4 — verify before delivery.** (1) every section and hpf XML parses, (2) zero `linesegarray` remaining, (3) `mimetype` first and STORED, (4) `zip.testzip()` returns None, (5) unedited `<hp:t>` identical to the original, (6) the number of changed entries matches the intent.

## 3. Editing pptx

**DC-7 "복구하시겠습니까?" is a warning, not an error.** Choosing to repair opens the file normally. Do not misread it as "will not open" and waste effort. A deck with embedded fonts can raise this prompt from the original file itself — when in doubt, byte-diff against the original first to establish that the edit was not the cause.

**DC-8 The usual cause is `<Default xmlns="" .../>` in `[Content_Types].xml`.** The empty `xmlns=""` pulls `Default` out of the OPC namespace, violating the schema and triggering repair. Removing just the `xmlns=""` cleans it while keeping embedded fonts. Removal is optional.

**DC-9 The diagnostic oracle is .NET `System.IO.Packaging.Package.Open`** (`Add-Type WindowsBase`). PowerPoint COM fails unconditionally in this environment even on healthy files (automation is blocked), so it is useless. python-pptx, zipfile and minidom are far too permissive and pass broken files. Trust only .NET OPC for the OPC layer — noting it does not check the slide PresentationML schema.

**DC-10 A python-pptx round-trip drops embedded fonts (.fntdata) and breaks the deck.** Use manual ZIP/XML injection, or produce a new file only. Recompress with the original `compress_type` profile (STORED stays STORED) and build fresh `ZipInfo` objects preserving `external_attr` and `date_time`.

**DC-11 When removing a slide, remove both the `sldIdLst` entry in `presentation.xml` and the rId in `presentation.xml.rels`.** Missing either leaves a dangling reference. Overwriting existing slides and appending only the shortfall is lower risk than removal.

**DC-12 Change one variable at a time when diagnosing.** Changing several at once makes it impossible to narrow the cause.

## 4. New lessons

**DC-13** Add document-editing and extraction lessons here with the measured date, and update the rule count in the header.

**DC-14** A trap that turns out to belong to the shell or encoding layer rather than the document format goes to `work-rules-shell` instead, so each file keeps one responsibility.
