import type { Register } from 'claude-code'

import type { Candidate, ErrorSummary, PostKind, SessionRecord, StepStatus } from '../src/core'
import {
  addCandidate, applyPost, applyPrompt, applySkillLoad, applyToolFailure, applyToolUse, countPorcelain, emptyRecord,
  isViewerAlive, liveSessions, markSkillsStale, normalizeRecord, parseCount, parseErrorsJson,
  removeCandidate, REPO_REFRESH_MS, setAgents, setPlan, setRepos, setStep,
} from '../src/core'
import type { Actions, Glossary, Tab, ViewData } from '../src/view'
import { band, isTab, pane } from '../src/view'

// 등록만 한다. 판정은 src/core, 그리기는 src/view (설계서 2장).
// 모든 세션은 자기 상태를 $.store에 올리고(P-15), /panel을 연 세션은 다른 세션을 그린다.
// $는 파일 최상위에 선언한 함수에만 넘길 수 있다 (엔진의 정적 검사).

const PANE = 'work-panel'
const PANE_ROWS = 60 // P-2: 사용자 요청 2026-10-13 "패널의 크기를 고정할 순 없어?", "더 높여줘"
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
let tab: Tab = 'session'
let pick = 0
let view: Omit<ViewData, 'tab' | 'now'> = {
  shown: null, others: 0, errors: null, errorsFailed: false, candidates: [], marked: new Set(), globalRules: null, glossary: {},
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
  view = { ...view, shown, others: live.length, candidates, marked: new Set(candidates.map(c => c.at + '|' + c.text)) }
  if (now - lastErrorsRun > ERRORS_REFRESH_MS) await refreshErrors($, false)
  // P-15 디자인 검토: 바뀐 것이 있을 때만 다시 그린다 (입력 중인 글자를 지우지 않게)
  const hash = JSON.stringify([shown && { ...shown, updatedAt: 0 }, view.candidates.length, view.errors?.generated, tab, pick])
  if (hash !== lastHash) {
    lastHash = hash
    $.ui.invalidate('ui.render')
  }
}

async function startViewer($: any): Promise<void> {
  const saved = await $.store.get('viewer:tab')
  // P-2: 번호로 저장하던 예전 값은 탭 이름이 아니므로 세션 탭으로 연다
  tab = isTab(saved) ? saved : 'session'
  view = { ...view, globalRules: await countGlobalRules($), glossary: await loadGlossary($) }
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

// P-6: 규칙 ID마다 한국어 한 문장. 원본이 바뀌어 원문이 다르면 scripts/extract_rules.py --check가 잡는다.
async function loadGlossary($: any): Promise<Glossary> {
  const out: Glossary = { 'skill-gate': '필요한 스킬을 읽기 전 첫 커밋, 위임, 코드 수정을 한 번 막는다' }
  try {
    const v = await readJson($, $.plugin.root + '/data/rules-ko.json')
    if (v && typeof v === 'object') {
      for (const [id, entry] of Object.entries(v as Record<string, { ko?: string }>)) if (entry.ko) out[id] = entry.ko
    }
  } catch {
    // 설명이 없으면 ID만 보인다
  }
  return out
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
    mark: c => void markCandidate($, c),
    unmark: c => void unmarkCandidate($, c),
  }
}

async function unmarkCandidate($: any, c: Candidate): Promise<void> {
  const path = (await journalDir($)) + '/candidates.json'
  const v = await readJson($, path)
  const list = removeCandidate(Array.isArray(v) ? (v as Candidate[]) : [], c)
  await $.fs.write(path, JSON.stringify(list, null, 1))
  view = { ...view, candidates: list, marked: new Set(list.map(x => x.at + '|' + x.text)) }
  $.ui.invalidate('ui.render')
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
        // P-4, P-17: 쓰는 법은 부르는 순간 항상 보이는 이 설명에 둔다. 모델이 읽는 글이라 영어로 쓴다(G-01).
        'Post a note to the work panel the user watches beside this session. Write the text in Korean. ' +
        'The panel has room, so several sentences are fine: what was done and why, what is left. ' +
        'kind=progress when a plan step starts (once per step, never per tool call); ' +
        'kind=done when a unit of work finishes, with its result (test count, commit); ' +
        'kind=decision only while waiting on the user. Skip the panel for a task of only a few tool calls. ' +
        'The reply says whether the panel is open. Open: progress goes only here, and chat carries only what the user ' +
        'must decide and the conclusion, never a restatement of what was posted. Closed: report in chat as usual.',
      inputSchema: {
        type: 'object',
        properties: { kind: { type: 'string', enum: ['progress', 'done', 'decision'] }, text: { type: 'string', description: 'Korean. Several sentences are fine.' } },
        required: ['kind', 'text'],
      },
    })
    await $.tool.register({
      name: 'todo',
      isDeferred: false,
      description:
        'Write the work plan to the plan section at the bottom of the panel session tab, like plan mode. Only for work of three or more steps. ' +
        'op=set once at the start, steps in order, one Korean sentence each. op=start when a step begins and op=done ' +
        'when it ends, step counted from 1. Set again only when the plan changes. op=list returns the current plan.',
      inputSchema: {
        type: 'object',
        properties: {
          op: { type: 'string', enum: ['set', 'start', 'done', 'list'] },
          steps: { type: 'array', items: { type: 'string' } },
          step: { type: 'number' },
        },
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
        ? 'Panel open.'
        : 'Panel closed: report in chat as usual.',
    }
  })

  on('tool.call', { tool: 'mcp__work-panel__todo' }, async ($, e) => {
    const input = e as unknown as { op?: string; steps?: unknown; step?: number }
    const now = await $.clock.now()
    if (!rec) return { result: '세션 기록이 아직 없다.' }
    if (input.op === 'set') {
      const steps = Array.isArray(input.steps) ? input.steps.map(String) : []
      rec = setPlan(rec, steps, now)
      await publish($)
      return { result: `계획 ${rec.plan.length}단계를 적었다.` }
    }
    if (input.op === 'start' || input.op === 'done') {
      const status: StepStatus = input.op === 'start' ? 'doing' : 'done'
      const next = setStep(rec, Number(input.step), status, now)
      if (!next) return { result: `${input.step}번 단계가 없다. 계획은 ${rec.plan.length}단계다.` }
      rec = next
      await publish($)
      return { result: `${input.step}번 단계를 ${input.op === 'start' ? '진행 중으로' : '완료로'} 바꿨다.` }
    }
    const lines = rec.plan.map((p, i) => `${i + 1}. [${p.status}] ${p.text}`)
    return { result: lines.length ? lines.join(String.fromCharCode(10)) : '계획이 없다.' }
  })

  on('command.run', { command: 'panel' }, async $ => {
    // 이미 열린 패널은 크기 요청이 적용되지 않으므로 닫았다가 다시 연다 (P-2)
    await $.ui.close({ id: PANE })
    await $.ui.open({ id: PANE, title: '작업 현황', focus: true, rows: PANE_ROWS })
    await startViewer($)
    return {}
  })

  // P-2: 현황판을 연 세션에서만 프롬프트 위 줄에 탭 버튼을 그린다
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!viewerTimer) return next(e)
    const ui = $.ui.resolve(e) as any
    return band(ui, { ...view, tab, now: await $.clock.now() }, makeActions($))
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
    const minRows = Math.max(4, Math.min(PANE_ROWS, e.props.scroll.bodyRows))
    return pane(ui, { ...view, tab, now: await $.clock.now() }, makeActions($), minRows)
  }).catch(($, e, next) => {
    const { Text } = $.ui.resolve(e) as any
    return <Text dimColor>현황판을 그리지 못했습니다: {String(next.error?.message ?? 'unknown')}</Text>
  })
}
