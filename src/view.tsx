import type { Candidate, ErrorSummary, GlobalCheck, PostKind, SessionRecord, Todo } from './core'
import { clock, derivedTodos, folderName, globalChecks, sortTodos } from './core'

// 화면 조각. 상태와 동작 함수를 받아 트리만 그린다. 상태를 바꾸지 않는다 (설계서 2장).
// 디자인 검토 2026-10-13: 라벨 칸 6칸 고정, 색 대신 흐림과 굵게, 행 버튼에는 숫자 단축키 없음,
// 탭 이름은 다른 곳의 말과 겹치지 않게 세션 / 할 일 / 규칙 / 문제 / 후보.

export type Tab = 1 | 2 | 3 | 4 | 5

export type ViewData = {
  tab: Tab
  shown: SessionRecord | null
  others: number
  todos: Todo[]
  draft: string
  errors: ErrorSummary | null
  errorsFailed: boolean
  candidates: Candidate[]
  marked: Set<string>
  globalRules: number | null
  now: number
}

export type Actions = {
  setTab: (t: Tab) => void
  nextSession: () => void
  todoInput: (v: string) => void
  todoSubmit: (v: string) => void
  todoDone: (id: string) => void
  mark: (c: Candidate) => void
  unmark: (c: Candidate) => void
}

type Ui = { Box: any; Text: any; Button: any; Input: any }

const KIND: Record<PostKind, string> = { progress: '진행', done: '완료', decision: '결정' }
const ERROR_KIND: Record<string, string> = {
  tool_error: '도구 에러', blocked: '차단', rejected: '사용자 거부', interrupted: '중단', correction: '지적 후보',
}

// 라벨 칸은 가장 긴 라벨 "에이전트"(한글 4자, 8칸)가 한 줄에 들어가는 폭으로 고정하고,
// 라벨과 내용 사이를 세로 막대로 나눈다 (사용자 요청 2026-10-13)
const LABEL_COLUMNS = 9

function Row(ui: Ui, label: string, body: any, opts: { bold?: boolean; dim?: boolean; wrap?: boolean } = {}) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row">
      <Box width={LABEL_COLUMNS} flexShrink={0}>
        <Text dimColor={!opts.bold} bold={opts.bold} wrap="truncate-end">
          {label}
        </Text>
      </Box>
      <Text dimColor>│ </Text>
      <Text bold={opts.bold} dimColor={opts.dim} wrap={opts.wrap ? 'wrap' : 'truncate-end'}>
        {body}
      </Text>
    </Box>
  )
}

export function tabBar(ui: Ui, d: ViewData, a: Actions) {
  const { Box, Button } = ui
  const names: [Tab, string][] = [
    [1, '세션'],
    [2, '할 일'],
    [3, '규칙'],
    [4, d.errors ? `문제` : '문제'],
    [5, d.candidates.length ? `후보(${d.candidates.length})` : '후보'],
  ]
  return (
    <Box flexDirection="row" columnGap={2}>
      {names.map(([n, label]) => (
        <Button key={'tab-' + n} label={label} hotkey={String(n)} plain dimColor={d.tab !== n} onPress={() => a.setTab(n)} />
      ))}
    </Box>
  )
}

export function sessionTab(ui: Ui, d: ViewData, a: Actions) {
  const { Box, Text, Button } = ui
  const s = d.shown
  if (!s) {
    return (
      <Box flexDirection="column">
        <Text dimColor>지켜볼 다른 세션이 없습니다.</Text>
        <Text dimColor>왼쪽 VS Code에서 작업을 시작하면 여기에 보입니다.</Text>
        <Text dimColor>이 CLI 세션 자신의 작업은 여기에 나오지 않습니다.</Text>
      </Box>
    )
  }
  const age = Math.max(0, Math.round((d.now - s.updatedAt) / 60000))
  const decision = [...s.posts].reverse().find(p => p.kind === 'decision')
  const posts = s.posts.filter(p => p !== decision).slice(-6).reverse()
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={2}>
        <Text dimColor wrap="truncate-start">
          {folderName(s.cwd)} · {s.id.slice(0, 8)} · {age === 0 ? '방금' : `${age}분 전`}
        </Text>
        {d.others > 1 && <Button key="next-session" label={`다른 세션 ${d.others - 1}개`} plain onPress={a.nextSession} />}
      </Box>
      {Row(ui, '요청', s.task || '없음')}
      {decision && Row(ui, '결정', `${clock(decision.at)} ${decision.text}`, { bold: true, wrap: true })}
      {posts.length === 0 && !decision && Row(ui, '진행', '진행 메모 없음', { dim: true })}
      {posts.map(p => Row(ui, KIND[p.kind], `${clock(p.at)} ${p.text}`, { dim: p.kind === 'done' }))}
      {Row(ui, '에이전트', s.agents.length === 0 ? '없음' : s.agents.map(x => `${x.name} ${x.status}`).join(', '))}
      {s.repos.length === 0 && Row(ui, '저장소', '확인 전', { dim: true })}
      {s.repos.map(r =>
        Row(ui, '저장소', r.failed ? `${folderName(r.path)} 갱신 실패` : `${folderName(r.path)}  변경 ${r.dirty} · push 대기 ${r.unpushed}`),
      )}
    </Box>
  )
}

export function todoTab(ui: Ui, d: ViewData, a: Actions) {
  const { Box, Text, Button, Input } = ui
  const open = sortTodos(d.todos).filter(t => !t.done)
  const doneCount = d.todos.filter(t => t.done).length
  const auto = d.shown ? derivedTodos(d.shown.repos) : []
  return (
    <Box flexDirection="column">
      <Input key="todo-input" label="추가" placeholder="적고 Enter" value={d.draft} submitLabel="추가" onInput={a.todoInput} onSubmit={a.todoSubmit} />
      <Text dimColor>Tab 이동 · 입력 중 숫자는 글자로 들어감 · Esc 프롬프트로</Text>
      {open.length === 0 && auto.length === 0 && <Text dimColor>할 일이 없습니다. 위 칸에 적고 Enter를 누르세요.</Text>}
      {open.map(t => (
        <Box key={'todo-' + t.id} flexDirection="row" columnGap={1}>
          <Text wrap="truncate-end">
            {t.text}
            {t.by === 'claude' ? ' (Claude)' : ''}
          </Text>
          <Button key={'done-' + t.id} label="완료" onPress={() => a.todoDone(t.id)} />
        </Box>
      ))}
      {auto.map(line => (
        <Text dimColor>{line} (자동)</Text>
      ))}
      {doneCount > 0 && <Text dimColor>완료 {doneCount}건</Text>}
    </Box>
  )
}

function checkLine(c: GlobalCheck) {
  return `${c.id} ${c.label}  ${c.state}`
}

export function rulesTab(ui: Ui, d: ViewData) {
  const { Box, Text } = ui
  const s = d.shown
  const stale = s ? s.skills.filter(x => x.stale) : []
  const fresh = s ? s.skills.filter(x => !x.stale) : []
  return (
    <Box flexDirection="column">
      <Text dimColor>CLAUDE.md 전역 규칙 {d.globalRules ?? '?'}개 · 항상 적재</Text>
      {stale.map(x => (
        <Text bold wrap="truncate-end">
          {x.name} {x.rules ?? ''} 다시 읽기 필요
        </Text>
      ))}
      {fresh.length === 0 && stale.length === 0 && <Text dimColor>이번 구간에 읽은 스킬이 없습니다.</Text>}
      {fresh.map(x => (
        <Text wrap="truncate-end">
          {x.name} {x.rules ?? ''} <Text dimColor>"{x.task}"</Text>
        </Text>
      ))}
      <Text> </Text>
      {s && globalChecks(s).map(c => <Text bold={c.ok === false}>{checkLine(c)}</Text>)}
      <Text> </Text>
      {(!s || s.fired.length === 0) && <Text dimColor>발동한 규칙이 없습니다.</Text>}
      {s &&
        s.fired
          .slice(-6)
          .reverse()
          .map(f => (
            <Text wrap="truncate-end">
              {clock(f.at)} 발동 {f.id} <Text dimColor>{f.text}</Text>
            </Text>
          ))}
    </Box>
  )
}

function candidateKey(c: Candidate): string {
  return c.at + '|' + c.text
}

export function problemsTab(ui: Ui, d: ViewData, a: Actions) {
  const { Box, Text, Button } = ui
  const e = d.errors
  const row = (c: Candidate, label: string) => (
    <Box key={'p-' + candidateKey(c)} flexDirection="row" columnGap={1}>
      <Text wrap="truncate-end">{label}</Text>
      {d.marked.has(candidateKey(c)) ? (
        <Text dimColor>후보 등록됨</Text>
      ) : (
        <Button key={'mark-' + candidateKey(c)} label="기록 후보" onPress={() => a.mark(c)} />
      )}
    </Box>
  )
  const live: Candidate[] = (d.shown?.errors ?? []).slice(-5).reverse().map(x => ({
    at: new Date(x.at).toISOString(), kind: 'tool_error', tool: x.tool, text: x.text, task: d.shown?.task ?? '', session: d.shown?.id.slice(0, 8) ?? '',
  }))
  return (
    <Box flexDirection="column">
      {!e && <Text dimColor>{d.errorsFailed ? '에러 기록을 읽지 못했습니다.' : '에러 기록을 아직 만들지 않았습니다.'}</Text>}
      {e && (
        <Text dimColor wrap="truncate-end">
          30일 {Object.keys(ERROR_KIND).map(k => `${ERROR_KIND[k]} ${e.counts[k] ?? 0}`).join(' · ')}
        </Text>
      )}
      {e && e.repeats.map(r => <Text wrap="truncate-end">{r.n}회 [{r.tool || '?'}] {r.text}</Text>)}
      <Text> </Text>
      <Text dimColor>이번 세션</Text>
      {live.length === 0 && <Text dimColor>실패 없음</Text>}
      {live.map(c => row(c, `${clock(Date.parse(c.at))} ${c.tool} ${c.text}`))}
      {e && e.recent.length > 0 && <Text dimColor>최근 지적과 차단</Text>}
      {e && e.recent.slice(-5).reverse().map(c => row(c, `${ERROR_KIND[c.kind] ?? c.kind} ${c.text}`))}
    </Box>
  )
}

export function candidatesTab(ui: Ui, d: ViewData, a: Actions) {
  const { Box, Text, Button } = ui
  return (
    <Box flexDirection="column">
      {d.candidates.length === 0 && <Text dimColor>표시한 후보가 없습니다. 문제 탭에서 기록 후보를 누르세요.</Text>}
      {d.candidates.length > 0 && <Text dimColor>후보 {d.candidates.length}건 · 그날 portfolio-log 다이제스트에 들어감</Text>}
      {d.candidates
        .slice(-12)
        .reverse()
        .map(c => (
          <Box key={'c-' + candidateKey(c)} flexDirection="row" columnGap={1}>
            <Text wrap="truncate-end">
              {c.at.slice(5, 10)} {ERROR_KIND[c.kind] ?? c.kind} {c.text}
            </Text>
            <Button key={'unmark-' + candidateKey(c)} label="제거" onPress={() => a.unmark(c)} />
          </Box>
        ))}
    </Box>
  )
}

// P-2: 높이를 고정해 탭을 바꿔도 패널 크기가 변하지 않게 한다. 넘치면 패널 안에서 스크롤된다.
export function pane(ui: Ui, d: ViewData, a: Actions, height: number) {
  const { Box, Text } = ui
  const body =
    d.tab === 1 ? sessionTab(ui, d, a) : d.tab === 2 ? todoTab(ui, d, a) : d.tab === 3 ? rulesTab(ui, d) : d.tab === 4 ? problemsTab(ui, d, a) : candidatesTab(ui, d, a)
  return (
    <Box flexDirection="column" height={height}>
      {tabBar(ui, d, a)}
      <Text> </Text>
      {body}
    </Box>
  )
}

// P-2: CLI 입력창에 포커스가 있어도 탭을 바꾸게, 프롬프트 위 줄에 같은 탭 버튼을 둔다.
// 이 줄의 숫자 버튼은 빈 입력창에 숫자 하나를 치고 잠깐 기다리면 눌린다 (Mods reference, Button 규칙).
export function band(ui: Ui, d: ViewData, a: Actions) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" columnGap={2}>
      <Text dimColor>현황판</Text>
      {tabBar(ui, d, a)}
    </Box>
  )
}
