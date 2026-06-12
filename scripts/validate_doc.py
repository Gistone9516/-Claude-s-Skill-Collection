#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
validate_doc.py — 문서 패키징 배포 전 검증 (수동 실행)

용법:
    python validate_doc.py <문서경로> [--original <원본경로>]

검증된 오라클만 사용 (CLAUDE.md 규칙 준수):
  - hwpx : zipfile + xml.etree 로 rule-4 검사
  - pptx : ★순수 python/zipfile은 너무 관대 → .NET OPC(Package.Open) 를 PowerShell로 호출
  - docx : zip testzip + 핵심 XML parse

출력은 콘솔(UTF-8 강제) + <문서경로>.validation.txt(UTF-8) 양쪽.
종료코드: 통과 0 / 실패 1.
"""

import sys
import os
import argparse
import zipfile
import re
import subprocess
import xml.etree.ElementTree as ET

# Windows cp949 콘솔에서 한글/특수문자 출력 시 UnicodeEncodeError 방지
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

PASS, FAIL, WARN, INFO = "PASS", "FAIL", "WARN", "INFO"


# ---------------------------------------------------------------------------
# 공통 헬퍼
# ---------------------------------------------------------------------------
def _localname(tag):
    """{ns}local → local"""
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse_ok(data, name, results):
    """XML 바이트가 파싱되는지 확인."""
    try:
        ET.fromstring(data)
        return True
    except ET.ParseError as e:
        results.append((FAIL, f"XML parse: {name}", str(e)))
        return False


def _zip_testzip(zf, results):
    bad = zf.testzip()
    if bad is None:
        results.append((PASS, "zip testzip", "CRC 무결성 OK"))
    else:
        results.append((FAIL, "zip testzip", f"손상 엔트리: {bad}"))


def _extract_t_texts(zf):
    """section*.xml 안의 모든 <*:t> 텍스트를 순서대로 수집."""
    texts = []
    for name in zf.namelist():
        base = name.split("/")[-1].lower()
        if base.startswith("section") and base.endswith(".xml"):
            try:
                root = ET.fromstring(zf.read(name))
            except ET.ParseError:
                continue
            for el in root.iter():
                if _localname(el.tag) == "t" and el.text:
                    texts.append(el.text)
    return texts


# ---------------------------------------------------------------------------
# hwpx
# ---------------------------------------------------------------------------
def validate_hwpx(path, original, results):
    with zipfile.ZipFile(path) as zf:
        # ④ zip 무결성
        _zip_testzip(zf, results)

        names = zf.namelist()

        # ① 모든 section*/header/content.hpf XML parse
        targets = [n for n in names
                   if n.lower().endswith(".xml") or n.lower().endswith(".hpf")]
        parse_fail = 0
        for n in targets:
            if not _parse_ok(zf.read(n), n, results):
                parse_fail += 1
        if parse_fail == 0:
            results.append((PASS, "XML parse (전체)", f"{len(targets)}개 엔트리 OK"))

        # ② linesegarray 잔재 (편집본은 0 기대)
        lsa = 0
        for n in names:
            base = n.split("/")[-1].lower()
            if base.startswith("section") and base.endswith(".xml"):
                lsa += len(re.findall(rb"<\w*:?linesegarray", zf.read(n)))
        if lsa == 0:
            results.append((PASS, "linesegarray 잔재", "0개"))
        else:
            results.append((WARN, "linesegarray 잔재",
                            f"{lsa}개 — 편집본이라면 제거 필요(미편집 원본이면 정상)"))

        # ③ mimetype = 첫 엔트리 & STORED & 내용
        info = zf.infolist()
        if not info or info[0].filename != "mimetype":
            results.append((FAIL, "mimetype 위치", "첫 엔트리가 mimetype 아님"))
        elif info[0].compress_type != zipfile.ZIP_STORED:
            results.append((FAIL, "mimetype 압축", "STORED 아님(비압축이어야 함)"))
        else:
            content = zf.read("mimetype").decode("ascii", "replace").strip()
            if content == "application/hwp+zip":
                results.append((PASS, "mimetype", "첫 엔트리·STORED·application/hwp+zip"))
            else:
                results.append((FAIL, "mimetype 내용", f"'{content}'"))

        # ⑤ --original: 미편집 본문 대비 변경된 <hp:t> 보고 (정보성)
        if original:
            cur = _extract_t_texts(zf)
            with zipfile.ZipFile(original) as ozf:
                orig = _extract_t_texts(ozf)
            changed = [(o, c) for o, c in zip(orig, cur) if o != c]
            len_note = "" if len(cur) == len(orig) else \
                f" / 텍스트노드 수 다름(원본 {len(orig)} vs 현재 {len(cur)})"
            if not changed and not len_note:
                results.append((PASS, "원본 대비 본문", "변경된 <hp:t> 없음"))
            else:
                sample = "; ".join(f"'{o}'→'{c}'" for o, c in changed[:5])
                results.append((INFO, "원본 대비 본문",
                                f"변경 {len(changed)}건{len_note} | {sample}"))


# ---------------------------------------------------------------------------
# pptx — .NET OPC 오라클
# ---------------------------------------------------------------------------
def _net_opc_open(path, results):
    """PowerShell + WindowsBase 로 OPC 무결성 확인 (python보다 엄격)."""
    p_esc = os.path.abspath(path).replace("'", "''")
    ps = (
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; "  # 한글 예외메시지 mojibake 방지
        "Add-Type -AssemblyName WindowsBase; "
        "try { "
        f"$p=[System.IO.Packaging.Package]::Open('{p_esc}',"
        "[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read); "
        "$null=$p.GetParts(); $p.Close(); Write-Output 'OPC_OK' "
        "} catch { Write-Output ('OPC_FAIL: ' + $_.Exception.Message) }"
    )
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
            capture_output=True, timeout=60,
        )
    except FileNotFoundError:
        results.append((WARN, "pptx OPC(.NET)", "powershell 미발견 — OPC 검증 생략"))
        return
    except subprocess.TimeoutExpired:
        results.append((FAIL, "pptx OPC(.NET)", "검증 timeout"))
        return
    text = (out.stdout or b"").decode("utf-8", "replace") + \
           (out.stderr or b"").decode("utf-8", "replace")
    if "OPC_OK" in text:
        results.append((PASS, "pptx OPC(.NET)", "Package.Open + GetParts OK"))
    else:
        msg = text.replace("OPC_FAIL:", "").strip() or "알 수 없는 OPC 오류"
        results.append((FAIL, "pptx OPC(.NET)", msg[:300]))


def validate_pptx(path, results):
    with zipfile.ZipFile(path) as zf:
        _zip_testzip(zf, results)
        # 핵심 XML parse
        ct = "[Content_Types].xml"
        if ct in zf.namelist():
            data = zf.read(ct)
            _parse_ok(data, ct, results)
            # <Default xmlns="" ...> = repair 유발 (CLAUDE.md)
            if re.search(rb'<Default[^>]*xmlns=""', data):
                results.append((FAIL, "Content_Types xmlns",
                                '<Default xmlns=""> 발견 — repair 유발(xmlns="" 제거 필요)'))
            else:
                results.append((PASS, "Content_Types xmlns", 'xmlns="" 없음'))
        else:
            results.append((FAIL, "Content_Types", "[Content_Types].xml 누락"))
    # .NET OPC (zip 닫은 뒤 별도 핸들로)
    _net_opc_open(path, results)


# ---------------------------------------------------------------------------
# docx
# ---------------------------------------------------------------------------
def validate_docx(path, results):
    with zipfile.ZipFile(path) as zf:
        _zip_testzip(zf, results)
        for n in ("[Content_Types].xml", "word/document.xml"):
            if n in zf.namelist():
                _parse_ok(zf.read(n), n, results)
            else:
                results.append((FAIL, f"필수 파트", f"{n} 누락"))
        results.append((PASS, "docx 기본 구조", "핵심 파트 parse 시도 완료"))


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="문서 패키징 배포 전 검증")
    ap.add_argument("path", help="검증할 문서 (.hwpx/.pptx/.docx)")
    ap.add_argument("--original", help="(hwpx) 원본 파일 — 본문 변경 diff용")
    args = ap.parse_args()

    path = args.path
    results = []  # (status, name, detail)

    if not os.path.exists(path):
        print(f"파일 없음: {path}")
        sys.exit(1)

    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".hwpx":
            validate_hwpx(path, args.original, results)
        elif ext == ".pptx":
            validate_pptx(path, results)
        elif ext == ".docx":
            validate_docx(path, results)
        else:
            print(f"지원 안 함 확장자: {ext} (.hwpx/.pptx/.docx)")
            sys.exit(1)
    except zipfile.BadZipFile:
        results.append((FAIL, "zip open", "ZIP으로 열 수 없음(파일 손상)"))
    except Exception as e:
        results.append((FAIL, "검증 예외", f"{type(e).__name__}: {e}"))

    # 리포트 작성
    has_fail = any(s == FAIL for s, _, _ in results)
    lines = [f"=== 검증: {path} ===", ""]
    for status, name, detail in results:
        lines.append(f"[{status:4}] {name} — {detail}")
    lines.append("")
    verdict = "DO NOT DELIVER" if has_fail else "DELIVER OK"
    lines.append(f">>> {verdict} <<<")
    report = "\n".join(lines)

    print(report)
    try:
        with open(path + ".validation.txt", "w", encoding="utf-8") as f:
            f.write(report + "\n")
    except Exception as e:
        print(f"(리포트 파일 기록 실패: {e})")

    sys.exit(1 if has_fail else 0)


if __name__ == "__main__":
    main()
