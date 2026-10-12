// 엔진을 모르는 순수 함수. 상태를 바꾸는 판정은 모두 여기에만 둔다 (설계서 2장).

export type PostKind = 'progress' | 'done' | 'decision'
export type Post = { kind: PostKind; text: string; at: number }
export type SkillLoad = { name: string; rules: string | null; at: number; task: string; stale: boolean }
export type Fired = { id: string; text: string; at: number }
export type AgentRow = { id: string; name: string; status: string }
export type RepoState = { path: string; dirty: number; unpushed: number; checkedAt: number; failed: boolean }
// P-5: Claude가 여러 단계 작업을 시작할 때 올리는 작업 계획 (사용자 2026-10-13: "너가 작업함에 있어서 plan 모드처럼 다음 작업 할 일을 적어두는 것")
export type StepStatus = 'todo' | 'doing' | 'done'
export type PlanStep = { text: string; status: StepStatus }

// P-10: Claude가 올린 포트폴리오 제안. 세션 정보는 자동으로, 나머지는 Claude가 한국어로 적는다.
export type SuggestionFields = { title: string; intent: string; problem: string; outcome: string; why: string; evidence: string }
export type Suggestion = SuggestionFields & { id: string; at: number; session: string; cwd: string; task: string }

// P-8: 이번 요청 안에서 센 값. 요청이 바뀌면 처음부터 센다.
export type TaskStats = { agents: number; agentsBeforeEdit: number; edited: boolean }

export type SessionRecord = {
  id: string
  cwd: string
  task: string
  // P-3: 이번 요청이 들어온 시각. 이보다 앞선 메모는 세션 탭에 보이지 않는다
  taskAt: number
  posts: Post[]
  skills: SkillLoad[]
  fired: Fired[]
  suggestions: Suggestion[]
  agents: AgentRow[]
  repos: RepoState[]
  plan: PlanStep[]
  planAt: number
  stats: TaskStats
  updatedAt: number
}

// P-11: candidates.json의 한 줄. plog.py collect(PL-18)가 이 필드 이름으로 읽는다.
export type Candidate = SuggestionFields & { id: string; at: string; session: string; cwd: string; task: string }

export const POST_LIMIT = 50
export const FIRED_LIMIT = 50
export const SUGGESTION_LIMIT = 20 // P-10: 세션마다
export const DISMISS_LIMIT = 500 // P-11
export const TRASH_SIZE = 10 // P-11: 사용자 2026-10-13 "10개까진 스택으로"
export const PENDING_LIMIT = 20 // P-10: 사용자 2026-10-13 "문제는 최대 20개까지"
export const PENDING_ALERT = 5 // P-10: 이만큼 쌓이면 탭 이름을 강조한다
export const TASK_LIMIT = 120
export const POST_TEXT_LIMIT = 800 // P-4: 패널은 자리가 넉넉하니 길게 써도 된다 (사용자 2026-10-13)
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
  return { id, cwd, task: '', taskAt: 0, posts: [], skills: [], fired: [], suggestions: [], agents: [], repos: [], plan: [], planAt: 0, stats: emptyStats(), updatedAt: now }
}

// P-3: 현재 요청은 첫 줄만, 가린 뒤에 남긴다. 요청이 바뀌면 P-8의 셈을 새로 시작한다.
export function applyPrompt(rec: SessionRecord, text: string, now: number): SessionRecord {
  const task = clean(text, TASK_LIMIT)
  if (!task) return rec
  return { ...rec, task, taskAt: now, stats: emptyStats(), updatedAt: now }
}

// P-4: 메모는 여러 줄이어도 한 문단으로 이어 붙인다
export function postText(text: string): string {
  const joined = text.split('\n').map(s => s.trim()).filter(Boolean).join(' ')
  return mask(joined.length > POST_TEXT_LIMIT ? joined.slice(0, POST_TEXT_LIMIT) + '…' : joined)
}

export function applyPost(rec: SessionRecord, kind: PostKind, text: string, now: number): SessionRecord {
  const post: Post = { kind, text: postText(text), at: now }
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

// P-9: 실패한 호출에서 발동한 규칙 표시만 남긴다. 단순 에러는 패널에 쌓지 않는다(P-10).
export function applyToolFailure(rec: SessionRecord, text: string, now: number): SessionRecord {
  const ids = extractFiredIds(text)
  if (ids.length === 0) return rec
  const line = clean(text, 200)
  return { ...rec, fired: [...rec.fired, ...ids.map(id => ({ id, text: line, at: now }))].slice(-FIRED_LIMIT), updatedAt: now }
}

// P-10: 제목과 문제가 비면 올리지 않는다. 모든 칸은 가린 뒤 한 문단으로 남긴다.
export function applySuggestion(rec: SessionRecord, input: Partial<Record<keyof SuggestionFields, unknown>>, now: number): SessionRecord | null {
  const field = (v: unknown, limit: number) => postText(typeof v === 'string' ? v : '').slice(0, limit)
  const s: Suggestion = {
    id: `${rec.id.slice(0, 8)}-${now}-${rec.suggestions.length}`,
    at: now,
    session: rec.id,
    cwd: rec.cwd,
    task: rec.task,
    title: field(input.title, 120),
    intent: field(input.intent, 400),
    problem: field(input.problem, 400),
    outcome: field(input.outcome, 400),
    why: field(input.why, 400),
    evidence: field(input.evidence, 400),
  }
  if (!s.title || !s.problem) return null
  return { ...rec, suggestions: [...rec.suggestions, s].slice(-SUGGESTION_LIMIT), updatedAt: now }
}

// P-10, P-11: 모든 세션의 제안 중 후보로 고르지도, 삭제하지도, 노트에 쓰지도 않은 것. 최근 것이 위로.
export function pendingSuggestions(records: SessionRecord[], candidates: Candidate[], dismissed: string[], used: string[]): Suggestion[] {
  const gone = new Set([...candidates.map(c => c.id), ...dismissed, ...used])
  return records.flatMap(r => r.suggestions).filter(s => !gone.has(s.id)).sort((a, b) => b.at - a.at).slice(0, PENDING_LIMIT)
}

// P-11: 휴지통은 삭제 목록의 끝 10건이다. 따로 저장하지 않는다.
export function trash(records: SessionRecord[], dismissed: string[]): Suggestion[] {
  const byId = new Map(records.flatMap(r => r.suggestions).map(s => [s.id, s] as const))
  return dismissed.slice(-TRASH_SIZE).reverse().map(id => byId.get(id)).filter((s): s is Suggestion => !!s)
}

export function dismiss(list: string[], id: string): string[] {
  return [...list.filter(x => x !== id), id].slice(-DISMISS_LIMIT)
}

export function restore(list: string[], id: string): string[] {
  return list.filter(x => x !== id)
}

export function toCandidate(s: Suggestion): Candidate {
  const { at, ...rest } = s
  return { ...rest, at: new Date(at).toISOString() }
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
  // 예전 칸의 세션 에러 목록(errors)은 더 쓰지 않으므로 버린다
  const { errors: _old, ...rest } = r as Partial<SessionRecord> & { errors?: unknown }
  return { ...emptyRecord(r.id, r.cwd ?? '', r.updatedAt), ...rest } as SessionRecord
}

// P-5: 계획은 통째로 바꾸거나, 단계 하나의 상태만 바꾼다. 단계 번호는 1부터 센다.
export const PLAN_LIMIT = 20

export function setPlan(rec: SessionRecord, steps: string[], now: number): SessionRecord {
  const plan = steps.map(t => clean(t, 200)).filter(Boolean).slice(0, PLAN_LIMIT).map(text => ({ text, status: 'todo' as StepStatus }))
  return { ...rec, plan, planAt: now, updatedAt: now }
}

export function setStep(rec: SessionRecord, step: number, status: StepStatus, now: number): SessionRecord | null {
  if (!Number.isInteger(step) || step < 1 || step > rec.plan.length) return null
  const plan = rec.plan.map((s, i) => (i === step - 1 ? { ...s, status } : s))
  return { ...rec, plan, updatedAt: now }
}

// P-11: candidates.json을 읽는다. id가 없는 예전 형식의 줄도 버리지 않고 그대로 둔다(제안과는 맞춰 보지 않는다).
export function parseCandidates(v: unknown): Candidate[] {
  return Array.isArray(v) ? (v.filter(x => typeof x === 'object' && x !== null) as Candidate[]) : []
}

// P-11: 같은 항목은 두 번 넣지 않는다
export function addCandidate(list: Candidate[], c: Candidate): Candidate[] {
  return list.some(x => x.id === c.id) ? list : [...list, c]
}

// P-11: 후보 탭에서 사람이 지운 항목, 또는 노트에 쓴 항목(PL-19)을 뺀다
export function removeCandidates(list: Candidate[], ids: string[]): Candidate[] {
  const drop = new Set(ids)
  return list.filter(x => !(typeof x.id === 'string' && drop.has(x.id)))
}

// P-11: candidates-used.json (plog.py candidates-used가 쓴다)
export function parseIdList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

export function clock(at: number, tzOffsetHours = 9): string {
  const d = new Date(at + tzOffsetHours * 3600 * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export function folderName(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] ?? cwd
}

// P-3: 세션 탭의 뼈대. 이번 요청 뒤에 올라온 메모만 종류별로, 최근 것이 위로 온다.
// P-5: 계획은 늘 보이고, 이번 요청 전에 세운 것이면 planStale로 흐리게 표시한다.
export type SessionSections = { decisions: Post[]; progress: Post[]; done: Post[]; planStale: boolean }

export function sessionSections(rec: SessionRecord): SessionSections {
  const mine = rec.posts.filter(p => p.at >= rec.taskAt).reverse()
  return {
    decisions: mine.filter(p => p.kind === 'decision'),
    progress: mine.filter(p => p.kind === 'progress'),
    done: mine.filter(p => p.kind === 'done'),
    planStale: rec.plan.length > 0 && rec.planAt < rec.taskAt,
  }
}
