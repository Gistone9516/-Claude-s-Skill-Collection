import { expect, test } from 'claude-code/testing'

import { applyPost, applyPrompt, emptyRecord, isViewerAlive, mask, pickSession, POST_LIMIT, STALE_MS } from './core'

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
  expect(r.posts[r.posts.length - 1].text).toBe('m' + (POST_LIMIT + 4))
})

test('P-15 pickSession skips self and stale sessions, takes the latest', () => {
  const now = STALE_MS * 2
  const rs = [
    { ...emptyRecord('self', 'x', 0), updatedAt: now },
    { ...emptyRecord('old', 'x', 0), updatedAt: now - STALE_MS - 1 },
    { ...emptyRecord('b', 'x', 0), updatedAt: now - 10 },
    { ...emptyRecord('c', 'x', 0), updatedAt: now - 5 },
  ]
  expect(pickSession(rs, 'self', now)?.id).toBe('c')
  expect(pickSession([rs[0], rs[1]], 'self', now)).toBe(null)
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
