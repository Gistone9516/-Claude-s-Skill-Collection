# README.md와 GUIDE.ko.md의 scripts/ 목록과 GUIDE의 작업 수칙 표를 manifest.json에서 만든다(구조 개선 3단계, 2026-11-21).
# 목록을 손으로 함께 고치다 두 문서가 어긋났다(README에만 skill-gate.sh, GUIDE의 규칙 수가 낡음). 이제 manifest의 ko, koWhen만 고친다.
# 사용법: python -I gen-doc-lists.py [--check]   --check는 고치지 않고 다르면 1로 끝난다
import json, os, re, sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEAD = re.compile(r'Rules:\s*([A-Z]{1,3})-1\.\.[A-Z]{1,3}-(\d+)\s*\((\d+)')


def load(p):
    with open(os.path.join(R, p), encoding='utf-8') as fh:
        return fh.read()


def script_lines(m, indent, width):
    out = []
    for f in m['files']:
        p = f.get('path', '')
        if p.startswith('scripts/') and f.get('ko'):
            out.append(indent + p[len('scripts/'):].ljust(width) + f['ko'])
    return out


def rule_count(name):
    try:
        t = load('skills/{}/SKILL.md'.format(name))
    except OSError:
        return '?'
    h = HEAD.search(t)
    return h.group(3) if h else '?'


def table_rows(m):
    return ['| `{}` | {} | {} |'.format(s['name'], s['koWhen'], rule_count(s['name'])) for s in m['skills'] if s.get('koWhen')]


def replace_block(lines, start_pred, row_pred, new):
    i = next(k for k, l in enumerate(lines) if start_pred(l))
    j = i + 1
    while j < len(lines) and row_pred(lines[j]):
        j += 1
    return lines[:i + 1] + new + lines[j:]


def main():
    check = '--check' in sys.argv
    m = json.loads(load('manifest.json'))
    changed = []
    for doc, indent, width, start in (('README.md', '  ', 21, lambda l: l == 'scripts/'), ('GUIDE.ko.md', '    ', 25, lambda l: l == '  scripts/')):
        text = load(doc)
        nl = '\r\n' if '\r\n' in text else '\n'
        lines = text.split(nl)
        lines = replace_block(lines, start, lambda l, ind=indent: l.startswith(ind) and not l.startswith(ind + ' ') and re.match(r'^\s+\S+\.(sh|ps1|py)\s', l) is not None, script_lines(m, indent, width))
        if doc == 'GUIDE.ko.md':
            h = lines.index('| 스킬 | 언제 | 규칙 수 |')
            lines = lines[:h + 1] + replace_block(lines[h + 1:], lambda l: l == '|---|---|---|', lambda l: l.startswith('| `'), table_rows(m))
        new = nl.join(lines)
        if new != text:
            changed.append(doc)
            if not check:
                with open(os.path.join(R, doc), 'w', encoding='utf-8', newline='') as fh:
                    fh.write(new)
    print(('differs: ' if check else 'updated: ') + (', '.join(changed) or 'none'))
    sys.exit(1 if check and changed else 0)


if __name__ == '__main__':
    main()
