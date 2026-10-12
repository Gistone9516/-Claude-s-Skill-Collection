import type { SessionRecord, PostKind } from './core'
import { clock, folderName } from './core'

// 화면 조각. 상태를 받아 트리만 그리고, 상태를 바꾸지 않는다 (설계서 2장).

const KIND_LABEL: Record<PostKind, string> = { progress: '진행', done: '완료', decision: '결정' }

type Elements = { Box: any; Text: any }

export function workTab(ui: Elements, shown: SessionRecord | null, now: number) {
  const { Box, Text } = ui
  if (!shown) {
    return (
      <Box flexDirection="column">
        <Text dimColor>지켜볼 다른 세션이 없습니다.</Text>
        <Text dimColor>왼쪽 VS Code에서 작업을 시작하면 여기에 보입니다.</Text>
      </Box>
    )
  }
  const ageMin = Math.max(0, Math.round((now - shown.updatedAt) / 60000))
  const posts = shown.posts.slice(-8)
  return (
    <Box flexDirection="column">
      <Text dimColor>
        {folderName(shown.cwd)} · {shown.id.slice(0, 8)} · {ageMin === 0 ? '방금' : `${ageMin}분 전`}
      </Text>
      <Text>요청  {shown.task || '없음'}</Text>
      {posts.length === 0 && <Text dimColor>진행 메모 없음</Text>}
      {posts.map(p => (
        <Text bold={p.kind === 'decision'}>
          {KIND_LABEL[p.kind]}  {clock(p.at)} {p.text}
        </Text>
      ))}
    </Box>
  )
}
