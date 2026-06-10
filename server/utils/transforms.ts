// server/utils/transforms.ts
import { basename } from 'path'

export interface HistorySession {
  id: string
  agent: 'codex' | 'claude'
  project: string
  cwd: string
  title: string
  model: string
  branch: string
  startedAt: number
  endedAt: number
  durationMs: number
  tokensUsed: number
  resumeCmd: string
}

interface ThreadRow {
  id: string
  cwd: string
  first_user_message: string
  model: string | null
  created_at_ms: number
  updated_at_ms: number
  git_branch: string | null
  tokens_used: number
}

export function transformHistoryRow(row: ThreadRow): HistorySession {
  return {
    id: row.id,
    agent: 'codex',
    project: basename(row.cwd),
    cwd: row.cwd,
    title: (row.first_user_message || '').slice(0, 200),
    model: row.model || 'unknown',
    branch: row.git_branch || 'main',
    startedAt: row.created_at_ms,
    endedAt: row.updated_at_ms,
    durationMs: row.updated_at_ms - row.created_at_ms,
    tokensUsed: row.tokens_used || 0,
    resumeCmd: `cd ${row.cwd} && codex resume ${row.id}`,
  }
}

function dayBounds(daysAgo: number): { start: number; end: number } {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  const start = d.getTime()
  d.setDate(d.getDate() + 1)
  return { start, end: d.getTime() }
}

/**
 * Returns 7 values: index 0 = 6 days ago, index 6 = today.
 * Each value = total minutes of sessions that started on that day.
 */
export function computeDailyMinutes(
  sessions: Array<{ startedAt: number; endedAt: number }>
): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const { start, end } = dayBounds(6 - i)
    return Math.round(
      sessions
        .filter(s => s.startedAt >= start && s.startedAt < end)
        .reduce((sum, s) => sum + (s.endedAt - s.startedAt) / 60_000, 0)
    )
  })
}
