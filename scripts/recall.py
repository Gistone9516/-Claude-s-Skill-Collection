# MyNAS 의미 검색(D-118, B-226)에 묻는 로컬 조회 도구. 훅과 Claude가 같은 경로로 쓴다.
# 서버가 꺼져 있거나 준비 전이면 아무것도 출력하지 않고 0으로 끝난다. 훅이 작업을 막지 않게 하려는 것이다.
# 사용법: python -I recall.py "질문" [--k 5] [--root C:\Users\ckffl\.claude] [--json]
import argparse, json, os, sys, urllib.request

WORK = os.environ.get('MYNAS_SEMANTIC_DIR', r'D:\HomeComputer\NAS\_mynas data\system\semantic')


def query(q, k=5, root=None, timeout=3.0):
    try:
        with open(os.path.join(WORK, 'semsearch.json'), encoding='utf-8') as fh:
            beat = json.load(fh)
        with open(os.path.join(WORK, 'token'), encoding='utf-8') as fh:
            token = fh.read().strip()
    except (OSError, ValueError):
        return None
    body = json.dumps({'q': q, 'k': k, 'root': root}).encode('utf-8')
    req = urllib.request.Request('http://127.0.0.1:{}/search'.format(beat['port']), data=body, method='POST',
                                 headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('q')
    ap.add_argument('--k', type=int, default=5)
    ap.add_argument('--root', default=None)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    res = query(a.q, a.k, a.root)
    if not res:
        return
    out = res.get('items') or []
    sys.stdout.reconfigure(encoding='utf-8')
    if a.json:
        print(json.dumps(res, ensure_ascii=False))
        return
    if not res.get('ready'):
        print('(색인 준비 중)')
    for it in out:
        print('- {} ({}) {}'.format(it['path'], it['score'], it['text'][:200]))


if __name__ == '__main__':
    main()
