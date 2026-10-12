import { expect, test } from 'claude-code/testing'

import {
  addCandidate, applyPost, applyPrompt, applySkillLoad, applySuggestion, applyToolFailure, applyToolUse, dismiss, emptyRecord,
  extractFiredIds, globalChecks, isViewerAlive, markSkillsStale, mask, normalizeRecord, parseCandidates, pendingSuggestions,
  parseRulesHeader, PENDING_LIMIT, pickSession, POST_LIMIT, POST_TEXT_LIMIT, removeCandidates, restore, sessionSections, setPlan, setStep, STALE_MS,
  toCandidate, trash, TRASH_SIZE,
} from './core'
import type { SessionRecord } from './core'

function suggested(id: string, n: number): SessionRecord {
  let r = applyPrompt(emptyRecord(id, 'C:/w/proj', 0), '요청 ' + id, 1)
  for (let i = 0; i < n; i++) r = applySuggestion(r, { title: `${id} 제목 ${i}`, problem: '문제' }, 10 + i) ?? r
  return r
}

// 시험 이름에 설계서의 규칙 ID를 넣는다 (V-1)

test('P-3 applyPrompt keeps the first line, masked', () => {
  const r = applyPrompt(emptyRecord('a', 'C:/w', 0), '\n  첫 줄 sk-ant-abcdefghijklmnopqrstuv\n둘째 줄', 5)
  expect(r.task).toBe('첫 줄 [MASKED]')
  expect(r.updatedAt).toBe(5)
})

test('P-3 applyPrompt ignores an empty prompt', () => {
  const base = emptyRecord('a', 'C:/w', 0)
  expect(applyPrompt(base, '   \n ', 9)).toBe(base)
})

test('P-4 applyPost keeps the newest posts only', () => {
  let r = emptyRecord('a', 'C:/w', 0)
  for (let i = 0; i < POST_LIMIT + 5; i++) r = applyPost(r, 'progress', 'm' + i, i)
  expect(r.posts.length).toBe(POST_LIMIT)
  expect(r.posts[r.posts.length - 1]?.text).toBe('m' + (POST_LIMIT + 4))
})

test('P-15 pickSession skips self and stale sessions, takes the latest', () => {
  const now = STALE_MS * 2
  const rs: ReturnType<typeof emptyRecord>[] = [
    { ...emptyRecord('self', 'x', 0), updatedAt: now },
    { ...emptyRecord('old', 'x', 0), updatedAt: now - STALE_MS - 1 },
    { ...emptyRecord('b', 'x', 0), updatedAt: now - 10 },
    { ...emptyRecord('c', 'x', 0), updatedAt: now - 5 },
  ]
  expect(pickSession(rs, 'self', now)?.id).toBe('c')
  expect(pickSession(rs.slice(0, 2), 'self', now)).toBe(null)
})

test('P-17 viewer is alive within 15 seconds of its last beat', () => {
  expect(isViewerAlive(1000, 16000)).toBe(true)
  expect(isViewerAlive(1000, 16001)).toBe(false)
  expect(isViewerAlive(undefined, 0)).toBe(false)
})

test('P-14 mask hides webhook urls and assigned secrets', () => {
  const out = mask('https://discord.com/api/webhooks/123/abcDEF token=supersecret1')
  expect(out.includes('abcDEF')).toBe(false)
  expect(out.includes('supersecret1')).toBe(false)
})

test('P-6 parseRulesHeader reads the range and count', () => {
  expect(parseRulesHeader('# x\n\nRules: SH-1..SH-34 (34). Ordered')).toBe('SH-1..SH-34 (34)')
  expect(parseRulesHeader('no header')).toBe(null)
})

test('P-7 applySkillLoad keeps one row per skill with the request it came under', () => {
  let r = applyPrompt(emptyRecord('a', 'x', 0), '패널 만들기', 1)
  r = applySkillLoad(r, 'userSettings:work-rules-shell', 'Rules: SH-1..SH-34 (34).', 2)
  r = applySkillLoad(r, 'work-rules-shell', 'Rules: SH-1..SH-34 (34).', 3)
  expect(r.skills.length).toBe(1)
  expect(r.skills[0]?.name).toBe('work-rules-shell')
  expect(r.skills[0]?.task).toBe('패널 만들기')
})

test('P-6 compaction marks every loaded skill stale', () => {
  const r = markSkillsStale(applySkillLoad(emptyRecord('a', 'x', 0), 'agent-ops', '', 1), 2)
  expect(r.skills[0]?.stale).toBe(true)
})

test('P-8 G-10 counts agents launched before the first edit of the request', () => {
  let r = applyPrompt(emptyRecord('a', 'x', 0), '요청', 1)
  expect(globalChecks(r)[0]?.state).toBe('아직 수정 없음')
  r = applyToolUse(applyToolUse(r, 'Agent', 2), 'Agent', 3)
  r = applyToolUse(r, 'Edit', 4)
  r = applyToolUse(r, 'Agent', 5)
  expect(globalChecks(r)[0]?.ok).toBe(true)
  expect(globalChecks(r)[1]?.state).toBe('3대')
  r = applyPrompt(r, '다음 요청', 6)
  r = applyToolUse(r, 'Write', 7)
  expect(globalChecks(r)[0]?.ok).toBe(false)
})

test('P-9 fired ids come from hook markers in failure text', () => {
  expect(extractFiredIds('[skill-gate] Read the work-rules-shell skill [G-27]')).toEqual(['skill-gate', 'G-27'])
  const r = applyToolFailure(emptyRecord('a', 'x', 0), '[skill-gate] blocked\nsecond', 1)
  expect(r.fired[0]?.id).toBe('skill-gate')
  expect(r.fired[0]?.text).toBe('[skill-gate] blocked')
  const plain = emptyRecord('b', 'x', 0)
  expect(applyToolFailure(plain, 'Exit code 1', 2)).toBe(plain)
})

test('P-10 suggestion keeps index fields, masked', () => {
  const base = applyPrompt(emptyRecord('abcdefgh-1234', 'C:/w/proj', 0), '패널 고쳐줘', 1)
  const r = applySuggestion(base, { title: '탭 통합', intent: '패널 단순화', problem: '두 탭이 같은 정보 token=abcdef1234', outcome: '합침', why: '설계 결정' }, 5)
  const s = r?.suggestions[0]
  expect(s?.id).toBe('abcdefgh-5-0')
  expect(s?.task).toBe('패널 고쳐줘')
  expect(s?.cwd).toBe('C:/w/proj')
  expect(s?.evidence).toBe('')
  expect(s?.problem.includes('abcdef1234')).toBe(false)
  expect(applySuggestion(base, { title: '문제 없음' }, 6)).toBe(null)
  expect(toCandidate(s!).at).toBe(new Date(5).toISOString())
})

test('P-10 pending suggestions skip picked and dismissed, across all sessions, newest first', () => {
  const a = suggested('a', 2)
  const b = suggested('b', 1)
  const all = pendingSuggestions([a, b], [], [], [])
  expect(all.map(s => s.title)).toEqual(['a 제목 1', 'a 제목 0', 'b 제목 0'])
  const picked = toCandidate(all[0]!)
  const legacy = { at: 't', text: '예전 후보' } as never
  const left = pendingSuggestions([a, b], [picked, legacy], [all[1]!.id], [all[2]!.id])
  expect(left).toEqual([])
  const many = pendingSuggestions([suggested('c', 15), suggested('d', 15)], [], [], [])
  expect(many.length).toBe(PENDING_LIMIT)
})

test('P-11 trash shows the last ten deletions, newest first, and restore brings one back', () => {
  const r = suggested('a', TRASH_SIZE + 2)
  let gone: string[] = []
  for (const s of r.suggestions) gone = dismiss(gone, s.id)
  const t = trash([r], gone)
  expect(t.length).toBe(TRASH_SIZE)
  expect(t[0]?.title).toBe(`a 제목 ${TRASH_SIZE + 1}`)
  gone = restore(gone, t[0]!.id)
  expect(pendingSuggestions([r], [], gone, []).map(s => s.title)).toEqual([`a 제목 ${TRASH_SIZE + 1}`])
})

test('P-11 addCandidate does not add the same item twice', () => {
  const c = toCandidate(suggested('a', 1).suggestions[0]!)
  expect(addCandidate(addCandidate([], c), c).length).toBe(1)
})

test('P-15 normalizeRecord reads a first-slice record without the new fields', () => {
  const r = normalizeRecord({ id: 'a', cwd: 'x', task: 't', posts: [], updatedAt: 1, errors: [{ tool: 'Bash' }] })
  expect(r?.skills).toEqual([])
  expect(r?.suggestions).toEqual([])
  expect('errors' in (r ?? {})).toBe(false)
  expect(r?.stats.agents).toBe(0)
  expect(normalizeRecord({ nope: 1 })).toBe(null)
})

test('P-11 removeCandidates drops only the matching ids and keeps legacy lines', () => {
  const [a, b] = suggested('a', 2).suggestions.map(toCandidate)
  const legacy = parseCandidates([{ at: 't', text: '예전 후보' }, 'junk'])
  expect(legacy.length).toBe(1)
  expect(removeCandidates([a!, b!, ...legacy], [a!.id])).toEqual([b!, ...legacy])
})

test('P-5 setPlan and setStep keep the plan in order, steps counted from 1', () => {
  let r = setPlan(emptyRecord('a', 'x', 0), ['설계', '  ', '구현', '시험'], 1)
  expect(r.plan.map(p => p.text)).toEqual(['설계', '구현', '시험'])
  r = setStep(r, 2, 'doing', 2) ?? r
  expect(r.plan[1]?.status).toBe('doing')
  expect(setStep(r, 9, 'done', 3)).toBe(null)
  expect(setStep(r, 0, 'done', 3)).toBe(null)
})

test('P-3 session sections show only posts after the current request, newest first', () => {
  let r = applyPrompt(emptyRecord('a', 'x', 0), '지난 요청', 1)
  r = applyPost(r, 'decision', '지난 결정', 2)
  r = setPlan(r, ['지난 계획'], 3)
  r = applyPrompt(r, '이번 요청', 10)
  r = applyPost(applyPost(r, 'progress', '첫 진행', 11), 'progress', '둘째 진행', 12)
  r = applyPost(r, 'done', '끝남', 13)
  let sec = sessionSections(r)
  expect(sec.decisions).toEqual([])
  expect(sec.progress.map(p => p.text)).toEqual(['둘째 진행', '첫 진행'])
  expect(sec.done.map(p => p.text)).toEqual(['끝남'])
  expect(sec.planStale).toBe(true)
  sec = sessionSections(setPlan(r, ['이번 계획'], 14))
  expect(sec.planStale).toBe(false)
  expect(sessionSections(applyPrompt(emptyRecord('b', 'x', 0), '계획 없음', 1)).planStale).toBe(false)
})

test('P-4 a post keeps several sentences across lines, capped and masked', () => {
  const r = applyPost(emptyRecord('a', 'x', 0), 'progress', '첫 문장.' + String.fromCharCode(10) + ' 둘째 문장 sk-ant-abcdefghijklmnopqrstuv.', 1)
  expect(r.posts[0]?.text).toBe('첫 문장. 둘째 문장 [MASKED].')
  const long = applyPost(emptyRecord('a', 'x', 0), 'done', 'ㄱ'.repeat(POST_TEXT_LIMIT + 5), 1)
  expect(long.posts[0]?.text.length).toBe(POST_TEXT_LIMIT + 1)
})
