// 엔진을 모르는 순수 함수. 상태를 바꾸는 판정은 모두 여기에만 둔다 (설계서 2장).

export type PostKind = 'progress' | 'done' | 'decision'

export type Post = { kind: PostKind; text: string; at: number }

export type SessionRecord = {
  id: string
  cwd: string
  task: string
  posts: Post[]
  updatedAt: number
}

export const POST_LIMIT = 50
export const TASK_LIMIT = 120
export const STALE_MS = 10 * 60 * 1000 // P-15: 10분 넘게 조용한 세션은 숨긴다
export const VIEWER_ALIVE_MS = 15 * 1000 // P-17

// P-14: plog.py의 PL-7과 같은 목록
const SECRET_RES = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /xox[abprs]-[A-Za-z0-9-]{10,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /client_secret[\w.-]*/g,
  /https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/\S+/g,
]
const SECRET_ASSIGN_RE = /((?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[:=]\s*)['"]?[^\s'"]{6,}['"]?/gi

export function mask(text: string): string {
  let out = text
  for (const re of SECRET_RES) out = out.replace(re, '[MASKED]')
  return out.replace(SECRET_ASSIGN_RE, (_m, head) => head + '[MASKED]')
}

export function firstLine(text: string, limit: number): string {
  const line = text.split('\n').map(s => s.trim()).find(s => s.length > 0) ?? ''
  return line.length > limit ? line.slice(0, limit) + '…' : line
}

export function emptyRecord(id: string, cwd: string, now: number): SessionRecord {
  return { id, cwd, task: '', posts: [], updatedAt: now }
}

// P-3: 현재 요청은 첫 줄만, 가린 뒤에 남긴다
export function applyPrompt(rec: SessionRecord, text: string, now: number): SessionRecord {
  const task = mask(firstLine(text, TASK_LIMIT))
  if (!task) return rec
  return { ...rec, task, updatedAt: now }
}

// P-4: 진행 메모는 최근 50개만
export function applyPost(rec: SessionRecord, kind: PostKind, text: string, now: number): SessionRecord {
  const post: Post = { kind, text: mask(firstLine(text, 300)), at: now }
  return { ...rec, posts: [...rec.posts, post].slice(-POST_LIMIT), updatedAt: now }
}

// P-15: 자기 세션을 빼고, 10분 안에 움직인 세션 중 가장 최근 것
export function pickSession(records: SessionRecord[], selfId: string, now: number): SessionRecord | null {
  const live = records
    .filter(r => r.id !== selfId && now - r.updatedAt <= STALE_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return live[0] ?? null
}

// P-17
export function isViewerAlive(lastBeat: number | undefined, now: number): boolean {
  return typeof lastBeat === 'number' && now - lastBeat <= VIEWER_ALIVE_MS
}

export function isSessionRecord(v: unknown): v is SessionRecord {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return typeof r.id === 'string' && typeof r.updatedAt === 'number' && Array.isArray(r.posts)
}

export function clock(at: number, tzOffsetHours = 9): string {
  const d = new Date(at + tzOffsetHours * 3600 * 1000)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function folderName(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] ?? cwd
}
