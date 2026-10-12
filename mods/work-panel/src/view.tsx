import type { Candidate, ErrorSummary, GlobalCheck, PostKind, SessionRecord, StepStatus } from './core'
import { clock, derivedTodos, folderName, globalChecks } from './core'

// 화면 조각. 상태와 동작 함수를 받아 트리만 그린다. 상태를 바꾸지 않는다 (설계서 2장).
// 디자인 검토 2026-10-13: 색 대신 흐림과 굵게, 행 버튼에는 숫자 단축키 없음,
// 탭 이름은 다른 곳의 말과 겹치지 않게 세션 / 계획 / 규칙 / 문제 / 후보.
// 사용자 2026-10-13: 한눈에 보려는 것이라 중요한 줄은 자르지 않고 전부 보인다.

export type Tab = 1 | 2 | 3 | 4 | 5

// P-6: 규칙 ID마다 한국어 한 문장 (data/rules-ko.json), 스킬마다 한 줄 설명
export type Glossary = Record<string, string>

export type ViewData = {
  tab: Tab
  shown: SessionRecord | null
  others: number
  errors: ErrorSummary | null
  errorsFailed: boolean
  candidates: Candidate[]
  marked: Set<string>
  globalRules: number | null
  glossary: Glossary
  now: number
}

export type Actions = {
  setTab: (t: Tab) => void
  nextSession: () => void
  mark: (c: Candidate) => void
  unmark: (c: Candidate) => void
}

type Ui = { Box: any; Text: any; Button: any }

const KIND: Record<PostKind, string> = { progress: '진행', done: '완료', decision: '결정' }
const ERROR_KIND: Record<string, string> = {
  tool_error: '도구 에러', blocked: '차단', rejected: '사용자 거부', interrupted: '중단', correction: '지적 후보',
}
const STEP_MARK: Record<StepStatus, string> = { todo: '[ ]', doing: '[>]', done: '[v]' }

// 스킬 이름마다 한 줄 설명 (GUIDE.ko.md의 스킬 표와 같은 말)
const SKILL_KO: Record<string, string> = {
  'work-rules-shell': '셸, git, 커밋 수칙',
  'work-rules-diagnosis': '원인 진단과 코드 변경 수칙',
  'verify-fanout': '근거 등급과 검증, 사전 확인',
  'work-rules-automation': '자동화와 Workflow, 훅 작성 수칙',
  'work-rules-writing': '사람이 읽는 한국어 글 수칙',
  'readme-writing': 'README 작성 지침',
  'work-rules-docs': 'hwpx, pptx 등 문서 파일 수칙',
  'work-rules-kit': '재사용 킷 프로젝트 수칙',
  'agent-ops': '에이전트 위임 정책',
  'ai-characteristics': '규칙이 왜 있는지 (AI 특성)',
  deepflow: '다각도 자문단',
  buildflow: '기획에서 구현까지 흐름',
  'new-hwpx-master': 'hwpx 공문 양식 채우기',
  'portfolio-log': '오늘 작업을 공부 노트로 기록',
  'plugin-authoring': 'mod 만들기',
}

// 라벨 칸은 가장 긴 라벨 "에이전트"(한글 4자, 8칸)가 한 줄에 들어가는 폭
const LABEL_COLUMNS = 9

function Row(ui: Ui, label: string, body: any, opts: { bold?: boolean; dim?: boolean; full?: boolean } = {}) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row">
      <Box width={LABEL_COLUMNS} flexShrink={0}>
        <Text dimColor={!opts.bold} bold={opts.bold} wrap="truncate-end">
          {label}
        </Text>
      </Box>
      <Text dimColor>│ </Text>
      <Text bold={opts.bold} dimColor={opts.dim} wrap={opts.full ? 'wrap' : 'truncate-end'}>
        {body}
      </Text>
    </Box>
  )
}

export function tabBar(ui: Ui, d: ViewData, a: Actions) {
  const { Box, Button } = ui
  const names: [Tab, string][] = [
    [1, '세션'],
    [2, '계획'],
    [3, '규칙'],
    [4, '문제'],
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

// 출력 우선순위: 요청과 결정 > 최근 진행 3개 > 계획 요약 > 에이전트, 저장소 > 지난 메모(한 줄로 자름)
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
  const rest = s.posts.filter(p => p !== decision).reverse()
  const recent = rest.slice(0, 3)
  const older = rest.slice(3, 8)
  const doing = s.plan.find(p => p.status === 'doing')
  const doneSteps = s.plan.filter(p => p.status === 'done').length
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={2}>
        <Text dimColor wrap="truncate-start">
          {folderName(s.cwd)} · {s.id.slice(0, 8)} · {age === 0 ? '방금' : `${age}분 전`}
        </Text>
        {d.others > 1 && <Button key="next-session" label={`다른 세션 ${d.others - 1}개`} plain onPress={a.nextSession} />}
      </Box>
      {Row(ui, '요청', s.task || '없음', { full: true })}
      {decision && Row(ui, '결정', `${clock(decision.at)} ${decision.text}`, { bold: true, full: true })}
      {recent.length === 0 && !decision && Row(ui, '진행', '진행 메모 없음', { dim: true })}
      {recent.map(p => Row(ui, KIND[p.kind], `${clock(p.at)} ${p.text}`, { full: true, dim: p.kind === 'done' }))}
      {s.plan.length > 0 &&
        Row(ui, '계획', `${doneSteps}/${s.plan.length}${doing ? ` 진행 중: ${doing.text}` : ''}`, { full: true })}
      {Row(ui, '에이전트', s.agents.length === 0 ? '없음' : s.agents.map(x => `${x.name} ${x.status}`).join(', '), { full: true })}
      {s.repos.length === 0 && Row(ui, '저장소', '확인 전', { dim: true })}
      {s.repos.map(r =>
        Row(ui, '저장소', r.failed ? `${folderName(r.path)} 갱신 실패` : `${folderName(r.path)}  변경 ${r.dirty} · push 대기 ${r.unpushed}`, { full: true }),
      )}
      {older.length > 0 && <Text> </Text>}
      {older.map(p => Row(ui, KIND[p.kind], `${clock(p.at)} ${p.text}`, { dim: true }))}
    </Box>
  )
}

// P-5: Claude가 적는 작업 계획. 사람은 보기만 한다.
export function planTab(ui: Ui, d: ViewData) {
  const { Box, Text } = ui
  const plan = d.shown?.plan ?? []
  const auto = d.shown ? derivedTodos(d.shown.repos) : []
  return (
    <Box flexDirection="column">
      {plan.length === 0 && <Text dimColor>작업 계획이 없습니다. 여러 단계 작업을 시작하면 Claude가 여기에 단계를 적습니다.</Text>}
      {plan.map((p, i) => (
        <Text bold={p.status === 'doing'} dimColor={p.status === 'done'} wrap="wrap">
          {STEP_MARK[p.status]} {i + 1}. {p.text}
        </Text>
      ))}
      {auto.length > 0 && <Text> </Text>}
      {auto.map(line => (
        <Text dimColor>{line} (자동)</Text>
      ))}
    </Box>
  )
}

function describe(g: Glossary, id: string): string {
  return g[id] ?? ''
}

export function rulesTab(ui: Ui, d: ViewData) {
  const { Box, Text } = ui
  const s = d.shown
  const stale = s ? s.skills.filter(x => x.stale) : []
  const fresh = s ? s.skills.filter(x => !x.stale) : []
  const skillLine = (name: string, rules: string | null) => `${name}  ${SKILL_KO[name] ?? ''}${rules ? `  (${rules})` : ''}`
  return (
    <Box flexDirection="column">
      <Text dimColor>CLAUDE.md 전역 규칙 {d.globalRules ?? '?'}개 · 항상 적재</Text>
      <Text> </Text>
      <Text dimColor>읽은 스킬</Text>
      {stale.map(x => (
        <Text bold wrap="wrap">
          {skillLine(x.name, x.rules)}  다시 읽기 필요
        </Text>
      ))}
      {fresh.length === 0 && stale.length === 0 && <Text dimColor>이번 구간에 읽은 스킬이 없습니다.</Text>}
      {fresh.map(x => (
        <Text wrap="wrap">{skillLine(x.name, x.rules)}</Text>
      ))}
      <Text> </Text>
      <Text dimColor>이번 요청의 전역 규칙</Text>
      {s && globalChecks(s).map((c: GlobalCheck) => (
        <Text bold={c.ok === false} wrap="wrap">
          {c.id} {describe(d.glossary, c.id) || c.label}  {c.state}
        </Text>
      ))}
      <Text> </Text>
      <Text dimColor>발동한 규칙</Text>
      {(!s || s.fired.length === 0) && <Text dimColor>없음</Text>}
      {s &&
        s.fired
          .slice(-6)
          .reverse()
          .map(f => (
            <Text wrap="wrap">
              {clock(f.at)} {f.id} {describe(d.glossary, f.id)}
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
        <Text dimColor wrap="wrap">
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

// P-2: 최소 높이를 주어 탭을 바꿔도 패널이 줄지 않게 하고, 넘치는 내용은 엔진이 스크롤한다
// (패널에 포커스가 있을 때 위아래 화살표, PageUp, PageDown).
export function pane(ui: Ui, d: ViewData, a: Actions, minRows: number) {
  const { Box, Text } = ui
  const body =
    d.tab === 1 ? sessionTab(ui, d, a) : d.tab === 2 ? planTab(ui, d) : d.tab === 3 ? rulesTab(ui, d) : d.tab === 4 ? problemsTab(ui, d, a) : candidatesTab(ui, d, a)
  return (
    <Box flexDirection="column" minHeight={minRows}>
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
