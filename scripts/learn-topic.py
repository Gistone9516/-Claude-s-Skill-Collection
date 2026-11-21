# Claude 작업 주제를 learning-harness 과목의 개념 목차에 넣고 옮긴다(work-rules-collab CL-7, 사용자 선택 2026-11-21).
# 대장(ledger)이 원본이다. 과목의 개요 문서(outline)에는 "Claude 작업" 단원 하나만 대장에서 다시 만들어 넣고, 다른 단원은 건드리지 않는다.
# 그래서 주제의 과목을 바꿔도(move) 대장만 고치고 sync하면 양쪽 과목이 함께 맞춰진다.
# 쓰기는 과목의 ai_server(127.0.0.1, .env 토큰)로 하고, 서버가 꺼져 있으면 state/outline.json을 직접 쓴다.
# 사용법:
#   python -I learn-topic.py subjects
#   python -I learn-topic.py add --subject <slug> --title "<개념 제목>" --scope "<무엇을 왜 했는지 한두 줄>"
#   python -I learn-topic.py move --id <id> --to <slug>
#   python -I learn-topic.py list
#   python -I learn-topic.py sync
import argparse, datetime, json, os, re, sys, urllib.request

GATEWAY = os.environ.get('LH_GATEWAY_JSON', r'F:\SUAN\claude\_study-gateway\gateway.json')
LEDGER = os.environ.get('LH_TOPIC_LEDGER', r'F:\SUAN\claude\_study-gateway\claude-topics.jsonl')
AREA = {'key': 'claude', 'label': 'Claude 작업'}


def subjects():
    out = {}
    for s in json.load(open(GATEWAY, encoding='utf-8')).get('subjects', []):
        d = s['dir']
        try:
            app = json.load(open(os.path.join(d, 'content', 'app.json'), encoding='utf-8'))
        except OSError:
            continue
        has = any(v.get('part') == 'conceptprob' for v in app.get('views', []))
        env = {}
        try:
            for line in open(os.path.join(d, '.env'), encoding='utf-8'):
                m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
                if m:
                    env[m.group(1)] = m.group(2)
        except OSError:
            pass
        out[s['slug']] = {'dir': d, 'title': app.get('title', s['slug']), 'concept': has, 'port': env.get('AI_SERVER_PORT'), 'token': env.get('AI_SERVER_TOKEN')}
    return out


def ledger():
    try:
        return [json.loads(l) for l in open(LEDGER, encoding='utf-8') if l.strip()]
    except OSError:
        return []


def save_ledger(rows):
    tmp = LEDGER + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + '\n')
    os.replace(tmp, LEDGER)


def api(sub, method, body=None):
    if not sub['port'] or not sub['token']:
        return None
    req = urllib.request.Request('http://127.0.0.1:{}/state/doc/outline'.format(sub['port']), method=method,
                                 data=json.dumps(body).encode('utf-8') if body is not None else None,
                                 headers={'X-AI-Token': sub['token'], 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception:
        return None


def read_outline(sub):
    r = api(sub, 'GET')
    if r and r.get('ok'):
        return r.get('doc'), 'api'
    for p in (os.path.join(sub['dir'], 'state', 'outline.json'), os.path.join(sub['dir'], 'content', 'outline.json')):
        try:
            return json.load(open(p, encoding='utf-8')), 'file'
        except OSError:
            continue
    return None, 'file'


def write_outline(sub, doc, via):
    if via == 'api':
        r = api(sub, 'PUT', doc)
        if r and r.get('ok'):
            return 'api'
    p = os.path.join(sub['dir'], 'state', 'outline.json')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p + '.tmp', 'w', encoding='utf-8') as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=2)
    os.replace(p + '.tmp', p)
    return 'file'


def sync(subs, rows, only=None):
    done = []
    for slug, sub in subs.items():
        if only and slug not in only or not sub['concept']:
            continue
        doc, via = read_outline(sub)
        doc = doc or {'areas': [], 'conceptOutline': {}}
        mine = [{'concept_id': r['id'], 'title': r['title'], **({'scope': r['scope']} if r.get('scope') else {})} for r in rows if r['subject'] == slug]
        areas = [a for a in doc.get('areas', []) if a.get('key') != AREA['key']]
        outline = {k: v for k, v in (doc.get('conceptOutline') or {}).items() if k != AREA['key']}
        if mine:
            areas.append(dict(AREA))
            outline[AREA['key']] = mine
        doc['areas'], doc['conceptOutline'] = areas, outline
        done.append('{}:{}:{}'.format(slug, len(mine), write_outline(sub, doc, via)))
    return done


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['subjects', 'add', 'move', 'list', 'sync'])
    ap.add_argument('--subject'); ap.add_argument('--title'); ap.add_argument('--scope', default='')
    ap.add_argument('--id'); ap.add_argument('--to')
    a = ap.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    subs = subjects()
    rows = ledger()
    if a.cmd == 'subjects':
        for k, v in subs.items():
            print('{}\t{}\t{}'.format(k, v['title'], '개념 화면 있음' if v['concept'] else '개념 화면 없음(넣을 수 없음)'))
        return
    if a.cmd == 'list':
        for r in rows:
            print('{}\t{}\t{}'.format(r['id'], r['subject'], r['title']))
        return
    if a.cmd == 'add':
        if a.subject not in subs or not subs[a.subject]['concept'] or not a.title:
            sys.exit('subject must be one with a concept view (see: subjects), and --title is required')
        day = datetime.date.today().strftime('%Y%m%d')
        n = sum(1 for r in rows if r['id'].startswith('cw-' + day)) + 1
        rows.append({'id': 'cw-{}-{}'.format(day, n), 'date': day, 'subject': a.subject, 'title': a.title.strip()[:120], 'scope': a.scope.strip()[:600]})
        save_ledger(rows)
        print('added', rows[-1]['id'], sync(subs, rows, {a.subject}))
        return
    if a.cmd == 'move':
        r = next((r for r in rows if r['id'] == a.id), None)
        if not r or a.to not in subs or not subs[a.to]['concept']:
            sys.exit('unknown id, or target subject has no concept view')
        old, r['subject'] = r['subject'], a.to
        save_ledger(rows)
        print('moved', a.id, sync(subs, rows, {old, a.to}))
        return
    print('synced', sync(subs, rows))


if __name__ == '__main__':
    main()
