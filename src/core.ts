// 엔진을 모르는 순수 함수. 상태를 바꾸는 판정은 모두 여기에만 둔다 (설계서 2장).

export type PostKind = 'progress' | 'done' | 'decision'
export type Post = { kind: PostKind; text: string; at: number }
export type SkillLoad = { name: string; rules: string | null; at: number; task: string; stale: boolean }
export type Fired = { id: string; text: string; at: number }
export type SessionError = { tool: string; text: string; at: number }
export type AgentRow = { id: string; name: string; status: string }
export type RepoState = { path: string; dirty: number; unpushed: number; checkedAt: number; failed: boolean }

// P-8: 이번 요청 안에서 센 값. 요청이 바뀌면 처음부터 센다.
export type TaskStats = { agents: number; agentsBeforeEdit: number; edited: boolean }

export type SessionRecord = {
  id: string
  cwd: string
  task: string
  posts: Post[]
  skills: SkillLoad[]
  fired: Fired[]
  errors: SessionError[]
  agents: AgentRow[]
  repos: RepoState[]
  stats: TaskStats
  updatedAt: number
}

export type Todo = { id: string; text: string; done: boolean; by: 'person' | 'claude'; at: number }
export type Candidate = { at: string; kind: string; tool: string; text: string; task: string; session: string }

export const POST_LIMIT = 50
export const FIRED_LIMIT = 50
export const ERROR_LIMIT = 30
export const TASK_LIMIT = 120
export const STALE_MS = 10 * 60 * 1000 // P-15
export const VIEWER_ALIVE_MS = 15 * 1000 // P-17
export const REPO_REFRESH_MS = 30 * 1000 // P-13

const AGENT_TOOLS = new Set(['Agent', 'Task', 'Workflow'])
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

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

function clean(text: string, limit: number): string {
  return mask(firstLine(text, limit))
}

export function emptyStats(): TaskStats {
  return { agents: 0, agentsBeforeEdit: 0, edited: false }
}

export function emptyRecord(id: string, cwd: string, now: number): SessionRecord {
  return { id, cwd, task: '', posts: [], skills: [], fired: [], errors: [], agents: [], repos: [], stats: emptyStats(), updatedAt: now }
}

// P-3: 현재 요청은 첫 줄만, 가린 뒤에 남긴다. 요청이 바뀌면 P-8의 셈을 새로 시작한다.
export function applyPrompt(rec: SessionRecord, text: string, now: number): SessionRecord {
  const task = clean(text, TASK_LIMIT)
  if (!task) return rec
  return { ...rec, task, stats: emptyStats(), updatedAt: now }
}

// P-4
export function applyPost(rec: SessionRecord, kind: PostKind, text: string, now: number): SessionRecord {
  const post: Post = { kind, text: clean(text, 300), at: now }
  return { ...rec, posts: [...rec.posts, post].slice(-POST_LIMIT), updatedAt: now }
}

// P-6: 스킬 본문의 머리말 "Rules: X-1..X-n (n)"에서 규칙 범위를 읽는다
export function parseRulesHeader(text: string): string | null {
  const m = /Rules:\s*([A-Z]{1,3}-1\.\.[A-Z]{1,3}-\d+)\s*\((\d+)\)/.exec(text)
  return m ? `${m[1]} (${m[2]})` : null
}

// P-7: 같은 스킬을 다시 읽으면 최신 한 줄로 바꾼다
export function applySkillLoad(rec: SessionRecord, name: string, text: string, now: number): SessionRecord {
  const short = name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : name
  const load: SkillLoad = { name: short, rules: parseRulesHeader(text), at: now, task: rec.task, stale: false }
  return { ...rec, skills: [...rec.skills.filter(s => s.name !== short), load], updatedAt: now }
}

// P-6: 압축되면 그 전에 읽은 스킬은 다시 읽어야 한다
export function markSkillsStale(rec: SessionRecord, now: number): SessionRecord {
  return { ...rec, skills: rec.skills.map(s => ({ ...s, stale: true })), updatedAt: now }
}

// P-8
export function applyToolUse(rec: SessionRecord, tool: string, now: number): SessionRecord {
  const s = rec.stats
  if (AGENT_TOOLS.has(tool)) {
    return { ...rec, stats: { ...s, agents: s.agents + 1, agentsBeforeEdit: s.edited ? s.agentsBeforeEdit : s.agentsBeforeEdit + 1 }, updatedAt: now }
  }
  if (EDIT_TOOLS.has(tool) && !s.edited) {
    return { ...rec, stats: { ...s, edited: true }, updatedAt: now }
  }
  return rec
}

export type GlobalCheck = { id: string; label: string; state: string; ok: boolean | null }

// P-8: 측정할 수 있는 전역 규칙의 이번 요청 상태
export function globalChecks(rec: SessionRecord): GlobalCheck[] {
  const s = rec.stats
  const brief = s.edited ? (s.agentsBeforeEdit >= 2 ? '수정 전 실행' : '수정 전 미실행') : '아직 수정 없음'
  const pending = rec.repos.reduce((n, r) => n + r.unpushed, 0)
  return [
    { id: 'G-10', label: '사전 확인', state: brief, ok: s.edited ? s.agentsBeforeEdit >= 2 : null },
    { id: 'G-22', label: '이번 요청 에이전트', state: `${s.agents}대`, ok: null },
    { id: 'G-11', label: 'push 대기', state: pending > 0 ? `${pending}개` : '없음', ok: pending === 0 },
  ]
}

// P-9: 막힌 호출의 사유나 훅 알림에서 [G-27], [skill-gate] 같은 표시를 읽는다
export function extractFiredIds(text: string): string[] {
  const ids = new Set<string>()
  for (const m of text.matchAll(/\[([A-Z]{1,3}-\d+|skill-gate)\]/g)) if (m[1]) ids.add(m[1])
  return [...ids]
}

export function applyToolFailure(rec: SessionRecord, tool: string, text: string, now: number): SessionRecord {
  const line = clean(text, 200)
  const fired = extractFiredIds(text).map(id => ({ id, text: line, at: now }))
  return {
    ...rec,
    errors: [...rec.errors, { tool, text: line, at: now }].slice(-ERROR_LIMIT),
    fired: [...rec.fired, ...fired].slice(-FIRED_LIMIT),
    updatedAt: now,
  }
}

export function setAgents(rec: SessionRecord, agents: AgentRow[], now: number): SessionRecord {
  return { ...rec, agents, updatedAt: now }
}

export function setRepos(rec: SessionRecord, repos: RepoState[], now: number): SessionRecord {
  return { ...rec, repos, updatedAt: now }
}

// P-13: git 출력에서 센다
export function countPorcelain(stdout: string): number {
  return stdout.split('\n').filter(l => l.trim().length > 0).length
}

export function parseCount(stdout: string): number {
  const n = parseInt(stdout.trim(), 10)
  return Number.isFinite(n) ? n : 0
}

// P-15
export function pickSession(records: SessionRecord[], selfId: string, now: number): SessionRecord | null {
  const live = records
    .filter(r => r.id !== selfId && now - r.updatedAt <= STALE_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return live[0] ?? null
}

export function liveSessions(records: SessionRecord[], selfId: string, now: number): SessionRecord[] {
  return records.filter(r => r.id !== selfId && now - r.updatedAt <= STALE_MS).sort((a, b) => b.updatedAt - a.updatedAt)
}

// P-17
export function isViewerAlive(lastBeat: number | undefined, now: number): boolean {
  return typeof lastBeat === 'number' && now - lastBeat <= VIEWER_ALIVE_MS
}

// 오래된 형식(1차 조각)의 칸도 읽을 수 있게 빈 필드를 채운다
export function normalizeRecord(v: unknown): SessionRecord | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Partial<SessionRecord>
  if (typeof r.id !== 'string' || typeof r.updatedAt !== 'number' || !Array.isArray(r.posts)) return null
  return { ...emptyRecord(r.id, r.cwd ?? '', r.updatedAt), ...r } as SessionRecord
}

// P-5: 할 일은 항목마다 키 하나 (여러 세션이 동시에 고쳐도 서로 덮지 않게)
export function todoKey(id: string): string {
  return 'todo:' + id
}

export function newTodo(id: string, text: string, by: Todo['by'], now: number): Todo | null {
  const t = clean(text, 200)
  return t ? { id, text: t, done: false, by, at: now } : null
}

export function isTodo(v: unknown): v is Todo {
  if (typeof v !== 'object' || v === null) return false
  const t = v as Record<string, unknown>
  return typeof t.id === 'string' && typeof t.text === 'string' && typeof t.done === 'boolean'
}

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => Number(a.done) - Number(b.done) || a.at - b.at)
}

// P-5: push 대기는 저장하지 않고 저장소 상태에서 매번 계산한다 (DG-3)
export function derivedTodos(repos: RepoState[]): string[] {
  return repos.filter(r => r.unpushed > 0).map(r => `push 대기: ${folderName(r.path)} ${r.unpushed}개`)
}

// P-10: plog.py errors가 쓴 errors.json
export type ErrorSummary = {
  generated: string
  counts: Record<string, number>
  repeats: { n: number; tool: string; text: string }[]
  recent: Candidate[]
}

export function parseErrorsJson(raw: string): ErrorSummary | null {
  try {
    const d = JSON.parse(raw)
    if (typeof d !== 'object' || d === null || typeof d.counts !== 'object') return null
    const items: any[] = Array.isArray(d.items) ? d.items : []
    const recent = items
      .filter(it => it.kind === 'correction' || it.kind === 'blocked' || it.kind === 'rejected')
      .slice(-10)
      .map(it => ({ at: String(it.ts), kind: String(it.kind), tool: String(it.tool ?? ''), text: mask(String(it.text ?? '')), task: mask(String(it.task ?? '')), session: String(it.session ?? '') }))
    const repeats = Array.isArray(d.repeats) ? d.repeats.slice(0, 5) : []
    return { generated: String(d.generated ?? ''), counts: d.counts, repeats, recent }
  } catch {
    return null
  }
}

// P-11: 같은 항목은 두 번 넣지 않는다
export function addCandidate(list: Candidate[], c: Candidate): Candidate[] {
  return list.some(x => x.at === c.at && x.text === c.text) ? list : [...list, c]
}

// P-11: 후보 탭에서 사람이 지운 항목을 뺀다
export function removeCandidate(list: Candidate[], c: Candidate): Candidate[] {
  return list.filter(x => !(x.at === c.at && x.text === c.text))
}

export function clock(at: number, tzOffsetHours = 9): string {
  const d = new Date(at + tzOffsetHours * 3600 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function folderName(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] ?? cwd
}
