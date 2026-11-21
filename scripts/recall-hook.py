# UserPromptSubmit 훅: 사용자가 지난 결정을 기억으로 말하면(G-06) MyNAS 의미 검색(D-118)으로 결정 기록 후보를 찾아 붙인다.
# 사용자 선택 2026-11-21 "결정 기록 확인만". 규칙 주입은 정확도(10문항 상위 3개 5/10)가 낮아 하지 않는다.
# 검색 서버가 꺼져 있거나 늦거나 결과가 없으면 아무것도 출력하지 않는다. 훅이 작업을 막으면 안 되기 때문이다.
import json, os, re, sys, importlib.util

TRIGGER = re.compile(r'지난번|저번|예전에|전에\s*(정|말|합의|결정)|정했던|정한\s*거|합의했|약속했|결정했|말했던|그때\s*(정|말|그)|기억\s*나')


def main():
    try:
        data = json.load(sys.stdin)
    except ValueError:
        return
    prompt = data.get('prompt') or ''
    if not TRIGGER.search(prompt):
        return
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location('recall', os.path.join(here, 'recall.py'))
    recall = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(recall)
    res = recall.query(prompt[-300:], 3, None, timeout=2.5)
    items = (res or {}).get('items') or []
    if not res or not res.get('ready') or not items:
        return
    lines = ['[recall] The user cites a past decision (G-06). Semantic search candidates for the record; read the file before agreeing, they may be off-target:']
    for it in items:
        lines.append('- {} (score {}): {}'.format(it['path'], it['score'], it['text'][:160]))
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'UserPromptSubmit', 'additionalContext': '\n'.join(lines)}}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        pass
