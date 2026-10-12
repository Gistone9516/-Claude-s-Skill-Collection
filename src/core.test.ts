import { expect, test } from 'claude-code/testing'

import {
  addCandidate, applyPost, applyPrompt, applySkillLoad, applyToolFailure, applyToolUse, derivedTodos, emptyRecord,
  extractFiredIds, globalChecks, isViewerAlive, markSkillsStale, mask, newTodo, normalizeRecord, parseErrorsJson,
  parseRulesHeader, pickSession, POST_LIMIT, STALE_MS,
} from './core'

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
  const r = applyToolFailure(emptyRecord('a', 'x', 0), 'Bash', '[skill-gate] blocked\nsecond', 1)
  expect(r.fired[0]?.id).toBe('skill-gate')
  expect(r.errors[0]?.text).toBe('[skill-gate] blocked')
})

test('P-5 push pending is derived from repos, and empty todos are refused', () => {
  expect(derivedTodos([{ path: 'C:/dev/myblog', dirty: 0, unpushed: 2, checkedAt: 0, failed: false }])).toEqual(['push 대기: myblog 2개'])
  expect(newTodo('i', '  ', 'person', 0)).toBe(null)
})

test('P-10 parseErrorsJson reads counts, repeats and masks recent items', () => {
  const s = parseErrorsJson(JSON.stringify({
    generated: 'g', counts: { tool_error: 3 }, repeats: [{ n: 4, tool: 'Edit', text: 'x' }],
    items: [{ ts: 't', kind: 'correction', text: 'token=abcdef1234', task: '', session: 's' }],
  }))
  expect(s?.counts.tool_error).toBe(3)
  expect(s?.repeats[0]?.n).toBe(4)
  expect(s?.recent[0]?.text.includes('abcdef1234')).toBe(false)
  expect(parseErrorsJson('not json')).toBe(null)
})

test('P-11 addCandidate does not add the same item twice', () => {
  const c = { at: 't', kind: 'tool_error', tool: 'Bash', text: 'x', task: '', session: '' }
  expect(addCandidate(addCandidate([], c), c).length).toBe(1)
})

test('P-15 normalizeRecord reads a first-slice record without the new fields', () => {
  const r = normalizeRecord({ id: 'a', cwd: 'x', task: 't', posts: [], updatedAt: 1 })
  expect(r?.skills).toEqual([])
  expect(r?.stats.agents).toBe(0)
  expect(normalizeRecord({ nope: 1 })).toBe(null)
})
