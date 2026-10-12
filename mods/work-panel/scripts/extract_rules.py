"""규칙 ID와 영어 제목을 원본(CLAUDE.md, 매니페스트의 로컬 스킬 SKILL.md)에서 뽑는다 (P-6).

python -I scripts/extract_rules.py            data/rules-src.json을 쓴다
python -I scripts/extract_rules.py --check    data/rules-ko.json의 원문과 지금 원본을 대조해 낡은 항목을 센다

stdout은 ASCII만 쓴다 (cp949 콘솔).
"""
import json
import re
import sys
from pathlib import Path

HOME = Path.home() / ".claude"
HERE = Path(__file__).resolve().parent.parent
DATA = HERE / "data"

# **G-05 No canonical source...** 또는 ### AI-1 It asserts...
BOLD_RE = re.compile(r"\*\*([A-Z]{1,3}-\d+)\s+([^*]+?)\*\*")
HEAD_RE = re.compile(r"^#{2,4}\s+([A-Z]{1,3}-\d+)\s+(.+)$", re.M)


def clean(title):
    title = re.sub(r"`([^`]*)`", r"\1", title).strip()
    return title.rstrip(".:").strip()


def extract():
    files = [HOME / "CLAUDE.md"]
    manifest = json.loads((HOME / "manifest.json").read_text(encoding="utf-8"))
    for s in manifest["skills"]:
        if s.get("kind") == "local" or s.get("name") == "portfolio-log":
            p = HOME / "skills" / s["name"] / "SKILL.md"
            if p.exists():
                files.append(p)
    rules = {}
    for f in files:
        text = f.read_text(encoding="utf-8")
        for m in list(HEAD_RE.finditer(text)) + list(BOLD_RE.finditer(text)):
            rid, title = m.group(1), clean(m.group(2))
            if rid not in rules and len(title) > 3:
                rules[rid] = {"en": title[:200], "file": f.parent.name if f.name == "SKILL.md" else "CLAUDE.md"}
    return rules


def main():
    rules = extract()
    DATA.mkdir(exist_ok=True)
    if "--check" in sys.argv:
        ko = json.loads((DATA / "rules-ko.json").read_text(encoding="utf-8"))
        stale = [r for r, v in rules.items() if r in ko and ko[r].get("en") != v["en"]]
        missing = [r for r in rules if r not in ko]
        print("rules=%d translated=%d stale=%d missing=%d" % (len(rules), len(ko), len(stale), len(missing)))
        if stale:
            print("stale:", ",".join(stale))
        if missing:
            print("missing:", ",".join(missing))
        return 1 if stale or missing else 0
    (DATA / "rules-src.json").write_text(json.dumps(rules, ensure_ascii=False, indent=1), encoding="utf-8")
    print("rules=%d" % len(rules))
    return 0


if __name__ == "__main__":
    sys.exit(main())
