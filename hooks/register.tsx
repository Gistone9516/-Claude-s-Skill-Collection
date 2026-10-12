import type { Register } from 'claude-code'

import type { PostKind, SessionRecord } from '../src/core'
import { applyPost, applyPrompt, emptyRecord, isSessionRecord, isViewerAlive, pickSession } from '../src/core'
import { workTab } from '../src/view'

// 등록만 한다. 판정은 src/core, 그리기는 src/view (설계서 2장).
// 모든 세션은 자기 상태를 $.store에 올리고(P-15), /panel을 연 세션은 다른 세션을 그린다.
// $는 파일 최상위에 선언한 함수에만 넘길 수 있다 (엔진의 정적 검사).

const PANE = 'work-panel'
const TOOL = 'panel_post'
const VIEWER_KEY = 'viewer'
const PUBLISH_MIN_MS = 1000 // P-15: 1초에 한 번 이하
const VIEWER_TICK_MS = 2000

let rec: SessionRecord | null = null
let lastPublish = 0
let publishQueued = false
let shown: SessionRecord | null = null
let viewerTimer: { cancel: () => void } | null = null

function sessionKey(id: string): string {
  return 'session:' + id
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
  await $.store.set(sessionKey(rec.id), rec)
}

async function viewerTick($: any): Promise<void> {
  const now = await $.clock.now()
  await $.store.set(VIEWER_KEY, now)
  const keys: string[] = await $.store.keys()
  const records: SessionRecord[] = []
  for (const k of keys) {
    if (!k.startsWith('session:')) continue
    const v = await $.store.get(k)
    if (isSessionRecord(v)) records.push(v)
  }
  shown = pickSession(records, rec ? rec.id : '', now)
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const now = await $.clock.now()
    rec = emptyRecord(await $.session.id(), await $.session.cwd(), now)
    await $.command.register({ name: 'panel', description: '작업 현황판을 엽니다' })
    await $.tool.register({
      name: TOOL,
      isDeferred: false,
      description:
        '작업 현황판에 진행 메모를 올린다. kind는 progress(진행 중), done(끝남), decision(사용자 결정이 필요함). ' +
        '응답에 현황판이 켜져 있는지가 온다. 켜져 있으면 진행 보고는 여기에만 하고 채팅에는 결정이 필요한 것과 결론만 쓴다. ' +
        '꺼져 있으면 채팅에 평소처럼 보고한다.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['progress', 'done', 'decision'] },
          text: { type: 'string', description: '한 줄 메모' },
        },
        required: ['kind', 'text'],
      },
    })
    return next(e)
  })

  // 현황판이 실패해도 사용자의 입력은 그대로 간다 (P-12)
  on('prompt.submit', async ($, e, next) => {
    if (rec) {
      rec = applyPrompt(rec, e.text, await $.clock.now())
      await publish($)
    }
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
    const beat = await $.store.get(VIEWER_KEY)
    const alive = isViewerAlive(typeof beat === 'number' ? beat : undefined, now)
    const text = alive
      ? '현황판 켜짐: 진행 보고는 현황판에만 하고, 채팅에는 결정이 필요한 것과 결론만 쓴다.'
      : '현황판 꺼짐: 채팅에 평소처럼 보고한다.'
    // 플러그인 도구의 결과는 문자열 그대로 돌려준다 (MCP의 content 배열은 형식 오류, 측정 2026-10-13)
    return { result: text }
  })

  on('command.run', { command: 'panel' }, async $ => {
    await $.ui.open({ id: PANE, title: '작업 현황' })
    if (!viewerTimer) {
      await viewerTick($)
      viewerTimer = $.clock.every(VIEWER_TICK_MS, () => void viewerTick($))
    }
    return {}
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && viewerTimer) {
      viewerTimer.cancel()
      viewerTimer = null
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e) as any
    return workTab(ui, shown, await $.clock.now())
  })
}
