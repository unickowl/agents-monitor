// server/api/projects.get.ts
import { getDb } from '~/server/utils/db'
import { computeDailyMinutes } from '~/server/utils/transforms'
import { basename } from 'path'

export interface Project {
  name: string
  cwd: string
  sessionCount: number
  lastActiveAt: number
  dailyMinutes: number[]
}

export default defineEventHandler((): Project[] => {
  const db = getDb()
  if (!db) return []

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000

  const rows = db.prepare(`
    SELECT cwd, created_at_ms, updated_at_ms
    FROM threads
    WHERE created_at_ms > ?
    ORDER BY updated_at_ms DESC
  `).all(cutoff) as Array<{ cwd: string; created_at_ms: number; updated_at_ms: number }>

  const byProject: Record<string, {
    name: string
    cwd: string
    lastActiveAt: number
    sessions: Array<{ startedAt: number; endedAt: number }>
  }> = {}

  for (const row of rows) {
    const name = basename(row.cwd)
    if (!byProject[name]) {
      byProject[name] = { name, cwd: row.cwd, lastActiveAt: 0, sessions: [] }
    }
    byProject[name].lastActiveAt = Math.max(byProject[name].lastActiveAt, row.updated_at_ms)
    byProject[name].sessions.push({ startedAt: row.created_at_ms, endedAt: row.updated_at_ms })
  }

  return Object.values(byProject)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .map(p => ({
      name: p.name,
      cwd: p.cwd,
      sessionCount: p.sessions.length,
      lastActiveAt: p.lastActiveAt,
      dailyMinutes: computeDailyMinutes(p.sessions),
    }))
})
