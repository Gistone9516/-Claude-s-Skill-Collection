export const meta = {
  name: 'fanout-verified',
  description: 'Parallel work over disjoint units with code-enforced caps, a fixed brief template and a schema-checked report; completion is judged afterwards by scripts/verify-artifacts.py',
  whenToUse: 'Several independent units of work (one folder or file set each) where each unit can name its artifacts and a command that proves it is done',
  phases: [{ title: 'Work' }, { title: 'Check' }],
}

// Rules moved from prose into code on 2026-11-21 (global-rules plan stage 5):
// - agent-ops AO-12 / CLAUDE.md G-22: the agent count is checked here against args.maxAgents, which the user approved.
// - agent-ops AO-14 / buildflow: parallel units must own disjoint paths; overlap throws before anything spawns.
// - agent-ops AO-15, AO-18: every worker gets the same brief fields and returns the Report envelope, enforced by schema.
// - work-rules-automation AU-8: a worker's "done" is not trusted; it must list artifacts and a check command,
//   and the caller runs scripts/verify-artifacts.py on the returned result. This script cannot read files.
//
// args: { task, maxAgents, effort?, model?, units: [{ id, goal, owns: [paths], out, check?, notes? }] }

const a = args || {}
const units = Array.isArray(a.units) ? a.units : []
if (!a.task || !units.length) throw new Error('args.task and args.units are required')
const MAX_PARALLEL = 5
const limit = Math.min(Number(a.maxAgents) || 0, MAX_PARALLEL)
if (!limit) throw new Error('args.maxAgents is required: the count the user approved (G-22)')
// one worker per unit plus one checker per unit that has a check command
const planned = units.length + units.filter((u) => u.check).length
if (planned > limit) throw new Error(`planned ${planned} agents exceeds approved maxAgents ${limit} (cap ${MAX_PARALLEL})`)

const owner = {}
for (const u of units) {
  if (!u.id || !u.goal || !Array.isArray(u.owns) || !u.owns.length || !u.out) throw new Error(`unit ${u.id || '?'} needs id, goal, owns[], out`)
  for (const p of u.owns) {
    const k = String(p).replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '')
    for (const [q, who] of Object.entries(owner)) {
      if (who !== u.id && (k === q || k.startsWith(q + '/') || q.startsWith(k + '/'))) throw new Error(`units ${who} and ${u.id} both own ${p}`)
    }
    owner[k] = u.id
  }
}

const REPORT = {
  type: 'object',
  properties: {
    ROUTE: { type: 'string', enum: ['relay', 'judge', 'respawn', 'escalate'] },
    STATUS: { type: 'string', enum: ['done', 'partial', 'failed', 'refused'] },
    TLDR: { type: 'string' },
    coverage: { type: 'string' },
    confidence: { type: 'string' },
    not_seen: { type: 'string' },
    assumptions: { type: 'string' },
    signal: { type: 'string' },
    artifacts: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, note: { type: 'string' } }, required: ['path'] } },
  },
  required: ['ROUTE', 'STATUS', 'TLDR', 'coverage', 'confidence', 'signal', 'artifacts'],
}

const CHECK = {
  type: 'object',
  properties: { exit_code: { type: 'integer' }, output_tail: { type: 'string' } },
  required: ['exit_code', 'output_tail'],
}

function brief(u) {
  return [
    `Overall task: ${a.task}`,
    `Your unit: ${u.id}. Goal: ${u.goal}`,
    `You own only these paths; do not edit anything else: ${u.owns.join(', ')}`,
    `Other units own other paths in parallel. Do not run git commands at all (work-rules-shell SH-7).`,
    `Write your output to ${u.out}. If writing to that absolute path fails, write relative to the repository root and report the actual path (AU-9).`,
    u.notes ? `Notes: ${u.notes}` : '',
    `Read every file you will change before editing it (AO-21). List every file you wrote in artifacts.`,
    `Report STATUS honestly: partial or failed is better than a false done. Put anything important that fits no field in signal.`,
    `Human-facing text you write (comments, docs) is Korean; this brief is English (G-01).`,
  ].filter(Boolean).join('\n')
}

const opts = (phase, label) => ({ phase, label, schema: REPORT, ...(a.effort ? { effort: a.effort } : {}), ...(a.model ? { model: a.model } : {}) })

const results = await pipeline(
  units,
  (u) => agent(brief(u), opts('Work', `work:${u.id}`)),
  async (rep, u) => {
    if (!u.check || !rep) return { unit: u.id, report: rep, check: null }
    const c = await agent(
      `Run exactly this command and nothing else, then report its exit code and the last 40 lines of output verbatim. Do not fix anything.\n${u.check}`,
      { phase: 'Check', label: `check:${u.id}`, schema: CHECK, effort: 'high', model: 'sonnet' },
    )
    return { unit: u.id, report: rep, check: c }
  },
)

const out = results.map((r, i) => r || { unit: units[i].id, report: null, check: null })
const lost = out.filter((r) => !r.report).map((r) => r.unit)
if (lost.length) log(`no report from: ${lost.join(', ')}`)
return {
  task: a.task,
  units: out.map((r, i) => ({ ...r, out: units[i].out, owns: units[i].owns, checkCommand: units[i].check || null })),
  next: 'Run python -I ~/.claude/scripts/verify-artifacts.py <this result saved as JSON>; do not report completion from these reports alone (AU-8).',
}
