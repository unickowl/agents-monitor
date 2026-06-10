import { getDb } from '~/server/utils/db'
import { transformHistoryRow, type HistorySession } from '~/server/utils/transforms'
import { parseClaudeSessions } from '~/server/utils/claudeHistory'

export default defineEventHandler((event): HistorySession[] => {
  const query = getQuery(event)
  const since = Number(query.since) || 7
  const project = query.project as string | undefined

  const cutoff = Date.now() - since * 24 * 60 * 60 * 1000

  // Codex sessions from SQLite
  const db = getDb()
  const codexRows = db
    ? (project && project !== 'all'
        ? db.prepare(`
            SELECT id, cwd, first_user_message, model, created_at_ms, updated_at_ms,
                   git_branch, tokens_used
            FROM threads
            WHERE created_at_ms > ? AND cwd LIKE ?
            ORDER BY updated_at_ms DESC
          `).all(cutoff, `%/${project}`) as any[]
        : db.prepare(`
            SELECT id, cwd, first_user_message, model, created_at_ms, updated_at_ms,
                   git_branch, tokens_used
            FROM threads
            WHERE created_at_ms > ?
            ORDER BY updated_at_ms DESC
          `).all(cutoff) as any[])
    : []

  const codexSessions = codexRows.map(transformHistoryRow)

  // Claude Code sessions from JSONL files
  let claudeSessions = parseClaudeSessions(since)
  if (project && project !== 'all') {
    claudeSessions = claudeSessions.filter(s => s.project === project)
  }

  return [...codexSessions, ...claudeSessions].sort((a, b) => b.startedAt - a.startedAt)
})
