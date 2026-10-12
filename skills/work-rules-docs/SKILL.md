---
name: work-rules-docs
description: Editing and extracting document files (hwpx, pptx, docx, xlsx) - a catalogue of measured corruption traps and the validated procedure for each. Read in full before changing a single character of an hwpx or pptx, and before extracting text from any document file. Triggers - hwpx 편집, pptx 편집, 한글 문서, 파워포인트, 문서 손상, 텍스트 추출, docx, xlsx.
---

# work-rules-docs — document file editing and extraction

Rules: DC-1..DC-17 (17).
For filling an hwpx official-document template end to end, use `new-hwpx-master`; this file holds the corruption rules that apply to any document work. Before rendering, editing or verifying a document, check that its application is not holding it open (CLAUDE.md G-28).

## 1. Extracting text (docx, xlsx, hwpx, pptx)

**DC-1 Always write extraction output to a UTF-8 file** and read it back with the Read tool. Printing Korean or `©` to the cp949 console kills the whole extraction (`work-rules-shell` SH-12).

## 2. Editing hwpx

There are two editing modes; pick one per file. **Text patch**: change a few characters of an existing document as bytes, with the rules below. **Tree edit**: restructure or rebuild the body with lxml, as `new-hwpx-master` does, where string manipulation of XML is forbidden (HX-8). Never restructure XML with string operations.

**DC-2 Remove every `linesegarray` in the section you touched.** The most common cause of corruption. Change one character and **all** `<hp:linesegarray>` elements in that section XML must go, not only those of the edited paragraphs; otherwise Hangul refuses the file ("문서가 손상되어 열 수 없음") or renders characters overlapping.

- Text patch: `re.sub(r"<hp:linesegarray>.*?</hp:linesegarray>", "", d, flags=re.S)` plus the self-closing form, then confirm the XML still parses. Tree edit: materialize the list before deleting, since deleting from a live lxml tree skips siblings.
- Safe because it is a geometry cache of line positions that Hangul recomputes on open.

**DC-3 Delete the hashkey when replacing an embedded image.** The `hashkey` on `<opf:item>` in `Contents/content.hpf` is a proprietary hash; a mismatch is corruption, and deleting the attribute skips the check. Replacement images keep the original pixel dimensions.

**DC-4 No CJK regex character classes in a text patch.** A range like `[一-鿿…]` can match Hangul on a boundary error and erase body text. Match and replace CJK with literal `str.find` / `str.replace`, and assert `count == expected` first.

**DC-5 Repackaging.** Copy the original zip and replace only the changed entries, preserving the other bytes, their order and their `compress_type`. `mimetype` is the first entry, STORED, `application/hwp+zip`. Body XML has no BOM and no CR/LF.

**DC-6 Verify before delivery.** (1) every section and hpf XML parses, (2) zero `linesegarray` remaining, (3) `mimetype` first and STORED, (4) `zip.testzip()` returns None, (5) unedited `<hp:t>` identical to the original, (6) the number of changed entries matches the intent. Then render (DC-15).

## 3. Editing pptx

**DC-7 "복구하시겠습니까?" is a warning, not an error.** Repair opens the file normally. A deck with embedded fonts can raise it from the original itself, so byte-diff against the original before blaming the edit.

**DC-8 The usual cause is `<Default xmlns="" .../>` in `[Content_Types].xml`**, which pulls `Default` out of the OPC namespace. Removing only the `xmlns=""` cleans it and keeps embedded fonts.

**DC-9 The diagnostic oracle is .NET `System.IO.Packaging.Package.Open`** (`Add-Type WindowsBase`). PowerPoint COM is blocked in this environment even on healthy files, and python-pptx, zipfile and minidom pass broken files. .NET OPC checks the OPC layer only, not the slide schema.

**DC-10 A python-pptx round-trip drops embedded fonts (.fntdata) and breaks the deck.** Inject into the ZIP/XML by hand or produce a new file. Keep each entry's `compress_type`, `external_attr` and `date_time`.

**DC-11 Removing a slide means removing both the `sldIdLst` entry in `presentation.xml` and its rId in `presentation.xml.rels`.** Overwriting existing slides and appending the shortfall is lower risk than removal.

**DC-12 Change one variable at a time when diagnosing.**

## 4. Verifying an hwpx or hwp — the render oracle

**DC-15 Hangul COM works here and is the only oracle that proves a document opens (measured 2026-08-01).** DC-6 proves the package is well formed, not that Hangul accepts it. A successful headless PDF export proves the file opens, and the PDF makes layout measurable.

```powershell
$hwp = New-Object -ComObject HWPFrame.HwpObject
try { $hwp.RegisterModule("FilePathCheckDLL", "FilePathCheckerModule") } catch { }
$hwp.XHwpWindows.Item(0).Visible = $false
$null = $hwp.Open($Src, "HWPX", "forceopen:true")
$act = $hwp.CreateAction("FileSaveAsPdf"); $set = $act.CreateSet(); $act.GetDefault($set)
$set.SetItem("FileName", $Pdf); $set.SetItem("Format", "PDF"); $null = $act.Execute($set)
$hwp.Clear(1); $hwp.Quit()
```

- Unlike PowerPoint (DC-9), Hangul COM is not blocked; do not generalize either way.
- Run it as a `Start-Job` with `Wait-Job -Timeout` and kill `Hwp*` on timeout, since a modal dialog would block the call. Pass paths as `-Param` arguments (`work-rules-shell` SH-29).
- **Hand COM an ASCII path (measured 2026-09-29).** Files under a Korean path timed out and exported fine once copied to the scratchpad; a timeout on a Korean path is not evidence of a corrupt build.
- **A `PDF_FAIL` is not proof of corruption (measured 2026-08-01).** Re-run the export on a file known to open. If it fails too, the cause is the environment, most often the file open in the Hangul GUI (G-28); fall back to DC-6 and let the user do the definitive open.
- Measure the PDF with PyMuPDF (page count, text blocks, bounding boxes) rather than eyeballing it.
- `Preview/PrvImage.png` is whatever the last editor saved; never use it as a rendering.

## 5. hwpx table layout

**DC-16 A table with `treatAsChar="1"` cannot split across pages, so growing it past one page blanks the page before it (measured 2026-08-22).** The table is an inline character, so Hangul pushes it whole to the next page. Set `treatAsChar="0"`, `horzRelTo="COLUMN"` and `pageBreak="CELL"`; `pageBreak` alone does not help. The tell is a first page holding only the running header. When a form's table must stay on one page, `treatAsChar="1"` is why.

- A blank middle page can also be a run of empty `<hp:p>` before a `pageBreak="1"` paragraph that spilled once content grew (measured 2026-10-07). Remove empties, not text.

**DC-17 Under-estimate `cellSz height`, never over-estimate.** Hangul keeps a declared height larger than the content as dead space and silently grows one that is too small (measured 2026-08-22: a too-high floor turned 2 pages into 3). Estimate lines with `chars_per_line` set slightly above the true value, keep only a floor that fits the label cell's own text, give the label and content cells of a row the same height, and verify by page count (DC-15).

## 6. How this file changes

**DC-13** A lesson revises the rule it belongs to in one or two lines with its measured date (`ai-characteristics` AI-17); a new rule updates the header count and `manifest.json` `ruleIds` in the same change.

**DC-14** A trap that belongs to the shell or encoding layer rather than the document format goes to `work-rules-shell`.
