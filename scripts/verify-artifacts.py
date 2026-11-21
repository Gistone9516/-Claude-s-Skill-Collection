# fanout-verified 워크플로우 결과를 코드로 판정한다(work-rules-automation AU-8, 전역 규칙 계획 5단계 2026-11-21).
# 에이전트의 STATUS done이나 확인 에이전트의 보고는 믿지 않고, 파일이 실제로 있는지와 확인 명령을 여기서 직접 다시 돌린 결과로만 판정한다.
# 사용법: python -I verify-artifacts.py <워크플로우 결과 json> [--cwd <저장소>] [--out <판정 json>]
import argparse, json, os, subprocess, sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('result')
    ap.add_argument('--cwd', default=None)
    ap.add_argument('--out', default=None)
    ap.add_argument('--timeout', type=int, default=600)
    a = ap.parse_args()
    with open(a.result, encoding='utf-8') as fh:
        res = json.load(fh)
    rows = []
    for u in res.get('units', []):
        rep = u.get('report') or {}
        row = {'unit': u.get('unit'), 'claimed': rep.get('STATUS'), 'missing': [], 'empty': [], 'check': None, 'verdict': 'pass'}
        paths = [x.get('path') for x in rep.get('artifacts', []) if x.get('path')] + [u.get('out')]
        for p in dict.fromkeys(filter(None, paths)):
            full = p if os.path.isabs(p) else os.path.join(a.cwd or os.getcwd(), p)
            if not os.path.exists(full):
                row['missing'].append(p)
            elif os.path.isfile(full) and os.path.getsize(full) == 0:
                row['empty'].append(p)
        cmd = u.get('checkCommand')
        if cmd:
            try:
                r = subprocess.run(cmd, shell=True, cwd=a.cwd, capture_output=True, timeout=a.timeout)
                tail = (r.stdout + r.stderr).decode('utf-8', 'replace')[-1500:]
                row['check'] = {'exit_code': r.returncode, 'tail': tail}
            except subprocess.TimeoutExpired:
                row['check'] = {'exit_code': None, 'tail': 'timeout'}
        if not rep:
            row['verdict'] = 'no-report'
        elif row['missing'] or row['empty']:
            row['verdict'] = 'fail'
        elif row['check'] and row['check']['exit_code'] != 0:
            row['verdict'] = 'fail'
        elif rep.get('STATUS') != 'done':
            row['verdict'] = 'partial'
        rows.append(row)
    summary = {'pass': sum(r['verdict'] == 'pass' for r in rows), 'total': len(rows), 'units': rows}
    text = json.dumps(summary, ensure_ascii=False, indent=1)
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as fh:
            fh.write(text)
    sys.stdout.reconfigure(encoding='utf-8')
    print('{}/{} pass'.format(summary['pass'], summary['total']))
    for r in rows:
        if r['verdict'] != 'pass':
            print('- {} {} missing={} empty={} check={}'.format(r['unit'], r['verdict'], r['missing'], r['empty'], (r['check'] or {}).get('exit_code')))
    sys.exit(0 if summary['pass'] == summary['total'] else 1)


if __name__ == '__main__':
    main()
