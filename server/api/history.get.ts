// server/api/history.get.ts
import { getDb } from '~/server/utils/db'
import { transformHistoryRow, type HistorySession } from '~/server/utils/transforms'

export default defineEventHandler((event): HistorySession[] => {
  const query = getQuery(event)
  const since = Number(query.since) || 7
  const project = query.project as string | undefined

  const db = getDb()
  if (!db) return []

  const cutoff = Date.now() - since * 24 * 60 * 60 * 1000

  const rows = project && project !== 'all'
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
      `).all(cutoff) as any[]

  return rows.map(transformHistoryRow)
})
