import type { Register } from 'claude-code'

import type { Candidate, ErrorSummary, PostKind, SessionRecord, Todo } from '../src/core'
import {
  addCandidate, applyPost, applyPrompt, applySkillLoad, applyToolFailure, applyToolUse, countPorcelain, emptyRecord,
  isTodo, isViewerAlive, liveSessions, markSkillsStale, newTodo, normalizeRecord, parseCount, parseErrorsJson,
  REPO_REFRESH_MS, setAgents, setRepos, todoKey,
} from '../src/core'
import type { Actions, Tab, ViewData } from '../src/view'
import { band, pane } from '../src/view'

// 등록만 한다. 판정은 src/core, 그리기는 src/view (설계서 2장).
// 모든 세션은 자기 상태를 $.store에 올리고(P-15), /panel을 연 세션은 다른 세션을 그린다.
// $는 파일 최상위에 선언한 함수에만 넘길 수 있다 (엔진의 정적 검사).

const PANE = 'work-panel'
const PANE_ROWS = 20 // P-2: 사용자 요청 2026-10-13 "패널의 크기를 고정할 순 없어?"
const PUBLISH_MIN_MS = 1000 // P-15
const VIEWER_TICK_MS = 2000
const ERRORS_REFRESH_MS = 10 * 60 * 1000 // P-10
// 이 컴퓨터의 portfolio-log 수집기. 다른 곳으로 옮기면 여기를 고친다.
const PLOG = 'C:/Users/USER/Desktop/2026-2 docs/포트폴리오 자동화/skills/portfolio-log/scripts/plog.py'

// 작업 세션 쪽 상태
let rec: SessionRecord | null = null
let lastPublish = 0
let publishQueued = false
let lastRepoCheck = 0

// 현황판 쪽 상태 (모듈 변수는 다시 로드되면 사라지므로 탭은 $.store에도 둔다)
let viewerTimer: { cancel: () => void } | null = null
let tab: Tab = 1
let pick = 0
let draft = ''
let view: Omit<ViewData, 'tab' | 'draft' | 'now'> = {
  shown: null, others: 0, todos: [], errors: null, errorsFailed: false, candidates: [], marked: new Set(), globalRules: null,
}
let lastHash = ''
let lastErrorsRun = 0

async function home($: any): Promise<string> {
  return ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '').split('\\').join('/')
}

async function journalDir($: any): Promise<string> {
  const set = await $.env.get('PORTFOLIO_JOURNAL_DIR')
  return set ? set.split('\\').join('/') : (await home($)) + '/portfolio-journal'
}

async function publish($: any): Promise<void> {
  if (!rec) return
  const now = await $.clock.now()
  if (now - lastPublish < PUBLISH_MIN_MS) {
    if (!publishQueued) {
      publishQueued = true
      $.clock.after(PUBLISH_MIN_MS, () => {
        publishQueued = false
        void publish($)
      })
    }
    return
  }
  lastPublish = now
  await $.store.set('session:' + rec.id, rec)
}

// P-13: 턴이 끝날 때만, 30초 간격 이상으로 git을 읽는다
async function refreshRepos($: any): Promise<void> {
  if (!rec) return
  const now = await $.clock.now()
  if (now - lastRepoCheck < REPO_REFRESH_MS) return
  lastRepoCheck = now
  const cwd = rec.cwd
  try {
    const top = await $.process.run(['git', '-C', cwd, 'rev-parse', '--show-toplevel'], { timeoutMs: 5000 })
    if (top.exitCode !== 0) return
    const path = top.stdout.trim()
    const st = await $.process.run(['git', '-C', path, 'status', '--porcelain'], { timeoutMs: 10000 })
    const ahead = await $.process.run(['git', '-C', path, 'rev-list', '--count', '@{u}..HEAD'], { timeoutMs: 10000 })
    rec = setRepos(rec, [{ path, dirty: countPorcelain(st.stdout), unpushed: ahead.exitCode === 0 ? parseCount(ahead.stdout) : 0, checkedAt: now, failed: st.exitCode !== 0 }], now)
  } catch {
    const prev = rec.repos[0]
    rec = setRepos(rec, [{ path: prev?.path ?? cwd, dirty: prev?.dirty ?? 0, unpushed: prev?.unpushed ?? 0, checkedAt: now, failed: true }], now)
  }
}

async function refreshAgents($: any): Promise<void> {
  if (!rec) return
  const list = await $.agent.list()
  const live = list.filter((x: any) => x.status === 'running' || x.status === 'pending' || x.status === 'waiting')
  rec = setAgents(rec, live.map((x: any) => ({ id: String(x.id), name: String(x.type || x.description || 'agent'), status: String(x.status) })), await $.clock.now())
}

async function loadTodos($: any): Promise<Todo[]> {
  const keys: string[] = await $.store.keys()
  const out: Todo[] = []
  for (const k of keys) {
    if (!k.startsWith('todo:')) continue
    const v = await $.store.get(k)
    if (isTodo(v)) out.push(v)
  }
  return out
}

async function readJson($: any, path: string): Promise<unknown> {
  if (!(await $.fs.exists(path))) return null
  return JSON.parse(await $.fs.read(path))
}

async function refreshErrors($: any, force: boolean): Promise<void> {
  const now = await $.clock.now()
  if (force || now - lastErrorsRun > ERRORS_REFRESH_MS) {
    lastErrorsRun = now
    try {
      await $.process.run(['python', '-I', PLOG, 'errors', '--days', '30'], { timeoutMs: 120000 })
    } catch {
      // 수집기가 실패해도 지난 결과를 그대로 보인다 (P-13)
    }
  }
  try {
    const path = (await journalDir($)) + '/errors/errors.json'
    const raw = (await $.fs.exists(path)) ? await $.fs.read(path) : null
    const parsed: ErrorSummary | null = raw ? parseErrorsJson(raw) : null
    view = { ...view, errors: parsed, errorsFailed: raw !== null && parsed === null }
  } catch {
    view = { ...view, errorsFailed: true }
  }
}

async function countGlobalRules($: any): Promise<number | null> {
  try {
    const text: string = await $.fs.read((await home($)) + '/.claude/CLAUDE.md')
    return new Set(text.match(/\bG-\d{2}\b/g) ?? []).size
  } catch {
    return null
  }
}

async function viewerTick($: any): Promise<void> {
  const now = await $.clock.now()
  await $.store.set('viewer', now)
  const keys: string[] = await $.store.keys()
  const records: SessionRecord[] = []
  for (const k of keys) {
    if (!k.startsWith('session:')) continue
    const r = normalizeRecord(await $.store.get(k))
    if (r) records.push(r)
  }
  const live = liveSessions(records, rec ? rec.id : '', now)
  const shown = live[pick % Math.max(1, live.length)] ?? null
  let candidates: Candidate[] = []
  try {
    const v = await readJson($, (await journalDir($)) + '/candidates.json')
    candidates = Array.isArray(v) ? (v as Candidate[]) : []
  } catch {
    candidates = []
  }
  view = { ...view, shown, others: live.length, todos: await loadTodos($), candidates, marked: new Set(candidates.map(c => c.at + '|' + c.text)) }
  if (now - lastErrorsRun > ERRORS_REFRESH_MS) await refreshErrors($, false)
  // P-15 디자인 검토: 바뀐 것이 있을 때만 다시 그린다 (입력 중인 글자를 지우지 않게)
  const hash = JSON.stringify([shown && { ...shown, updatedAt: 0 }, view.todos, view.candidates.length, view.errors?.generated, tab, pick])
  if (hash !== lastHash) {
    lastHash = hash
    $.ui.invalidate('ui.render')
  }
}

async function startViewer($: any): Promise<void> {
  const saved = await $.store.get('viewer:tab')
  if (saved === 1 || saved === 2 || saved === 3 || saved === 4 || saved === 5) tab = saved
  view = { ...view, globalRules: await countGlobalRules($) }
  lastHash = ''
  await refreshErrors($, false)
  await viewerTick($)
  if (!viewerTimer) viewerTimer = $.clock.every(VIEWER_TICK_MS, () => void viewerTick($))
}

async function setTab($: any, t: Tab): Promise<void> {
  tab = t
  await $.store.set('viewer:tab', t)
  $.ui.invalidate('ui.render')
}

async function addTodo($: any, text: string, by: Todo['by']): Promise<Todo | null> {
  const todo = newTodo(crypto.randomUUID(), text, by, await $.clock.now())
  if (todo) await $.store.set(todoKey(todo.id), todo)
  return todo
}

async function finishTodo($: any, id: string): Promise<boolean> {
  const v = await $.store.get(todoKey(id))
  if (!isTodo(v)) return false
  await $.store.set(todoKey(id), { ...v, done: true })
  return true
}

// 패널과 프롬프트 위 줄이 같은 동작을 쓴다
function makeActions($: any): Actions {
  return {
    setTab: t => void setTab($, t),
    nextSession: () => {
      pick += 1
      lastHash = ''
      void viewerTick($)
    },
    todoInput: v => {
      draft = v
    },
    todoSubmit: v => {
      draft = ''
      void addTodo($, v, 'person').then(() => viewerTick($))
    },
    todoDone: id => void finishTodo($, id).then(() => viewerTick($)),
    mark: c => void markCandidate($, c),
  }
}

async function markCandidate($: any, c: Candidate): Promise<void> {
  const path = (await journalDir($)) + '/candidates.json'
  const v = await readJson($, path)
  const list = addCandidate(Array.isArray(v) ? (v as Candidate[]) : [], c)
  await $.fs.write(path, JSON.stringify(list, null, 1))
  view = { ...view, candidates: list, marked: new Set(list.map(x => x.at + '|' + x.text)) }
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const now = await $.clock.now()
    const id = await $.session.id()
    // 다시 로드되어도 이 세션의 기록을 이어 간다 (디자인 검토 2026-10-13)
    rec = normalizeRecord(await $.store.get('session:' + id)) ?? emptyRecord(id, await $.session.cwd(), now)
    await $.tool.register({
      name: 'panel_post',
      isDeferred: false,
      description:
        '작업 현황판에 진행 메모를 올린다. kind는 progress(진행), done(완료), decision(사용자 결정 필요). ' +
        '응답에 현황판이 켜져 있는지가 온다. 켜져 있으면 진행 보고는 여기에만 하고 채팅에는 결정이 필요한 것과 결론만 쓴다. ' +
        '꺼져 있으면 채팅에 평소처럼 보고한다.',
      inputSchema: {
        type: 'object',
        properties: { kind: { type: 'string', enum: ['progress', 'done', 'decision'] }, text: { type: 'string', description: '한 줄 메모' } },
        required: ['kind', 'text'],
      },
    })
    await $.tool.register({
      name: 'todo',
      isDeferred: false,
      description:
        '사용자와 함께 쓰는 할 일 목록(현황판 할 일 탭). op=add면 text를 추가하고, op=done이면 id 항목을 완료로 바꾼다. ' +
        'op=list면 열린 항목과 id를 돌려준다. 사용자가 할 일을 추가하거나 끝내 달라고 할 때 쓴다.',
      inputSchema: {
        type: 'object',
        properties: { op: { type: 'string', enum: ['add', 'done', 'list'] }, text: { type: 'string' }, id: { type: 'string' } },
        required: ['op'],
      },
    })
    await $.command.register({ name: 'panel', description: '작업 현황판을 엽니다' })
    const panes = await $.ui.panes()
    if (panes.some((p: { id: string }) => p.id === PANE)) await startViewer($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (rec) {
      rec = applyPrompt(rec, e.text, await $.clock.now())
      await publish($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // P-7
  on('skill.prompt', async ($, e, next) => {
    if (rec) {
      rec = applySkillLoad(rec, e.skill, e.text, await $.clock.now())
      await publish($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // P-6
  on('session.compact', async ($, e, next) => {
    if (rec && !e.agentId) {
      rec = markSkillsStale(rec, await $.clock.now())
      await publish($)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // P-8, P-9: 이 세션 자신의 도구 호출만 센다. 하위 에이전트와 현황판 도구는 뺀다.
  on('tool.call', async ($, e, next) => {
    if (!rec || e.agentId || e.tool.startsWith('mcp__work-panel__')) return next(e)
    rec = applyToolUse(rec, e.tool, await $.clock.now())
    const ran: any = await next(e)
    if (ran.deny !== undefined || ran.isError === true) {
      rec = applyToolFailure(rec, e.tool, String(ran.deny ?? ran.text ?? ''), await $.clock.now())
    }
    if (e.tool === 'Agent') await refreshAgents($)
    await publish($)
    return ran
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))

  on('turn.complete', async ($, e, next) => {
    await refreshRepos($)
    await refreshAgents($)
    await publish($)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__work-panel__panel_post' }, async ($, e) => {
    const input = e as unknown as { kind?: string; text?: string }
    const kind: PostKind = input.kind === 'done' || input.kind === 'decision' ? input.kind : 'progress'
    const now = await $.clock.now()
    if (rec) {
      rec = applyPost(rec, kind, String(input.text ?? ''), now)
      await publish($)
    }
    const beat = await $.store.get('viewer')
    const alive = isViewerAlive(typeof beat === 'number' ? beat : undefined, now)
    // 플러그인 도구의 결과는 문자열 그대로 돌려준다 (측정 2026-10-13)
    return {
      result: alive
        ? '현황판 켜짐: 진행 보고는 현황판에만 하고, 채팅에는 결정이 필요한 것과 결론만 쓴다.'
        : '현황판 꺼짐: 채팅에 평소처럼 보고한다.',
    }
  })

  on('tool.call', { tool: 'mcp__work-panel__todo' }, async ($, e) => {
    const input = e as unknown as { op?: string; text?: string; id?: string }
    if (input.op === 'add') {
      const t = await addTodo($, String(input.text ?? ''), 'claude')
      return { result: t ? `할 일 추가: ${t.text} (id ${t.id})` : '빈 할 일은 추가하지 않았다.' }
    }
    if (input.op === 'done') {
      return { result: (await finishTodo($, String(input.id ?? ''))) ? '완료로 바꿨다.' : '그 id의 할 일이 없다.' }
    }
    const open = (await loadTodos($)).filter(t => !t.done)
    return { result: open.length ? open.map(t => `${t.id}  ${t.text}`).join('\n') : '열린 할 일이 없다.' }
  })

  on('command.run', { command: 'panel' }, async $ => {
    await $.ui.open({ id: PANE, title: '작업 현황', focus: true, rows: PANE_ROWS })
    await startViewer($)
    return {}
  })

  // P-2: 현황판을 연 세션에서만 프롬프트 위 줄에 탭 버튼을 그린다
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!viewerTimer) return next(e)
    const ui = $.ui.resolve(e) as any
    return band(ui, { ...view, tab, draft, now: await $.clock.now() }, makeActions($))
  }).catch(($, e, next) => next(e))

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && viewerTimer) {
      viewerTimer.cancel()
      viewerTimer = null
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e) as any
    const height = Math.max(4, Math.min(PANE_ROWS, e.props.scroll.bodyRows))
    return pane(ui, { ...view, tab, draft, now: await $.clock.now() }, makeActions($), height)
  }).catch(($, e, next) => {
    const { Text } = $.ui.resolve(e) as any
    return <Text dimColor>현황판을 그리지 못했습니다: {String(next.error?.message ?? 'unknown')}</Text>
  })
}
