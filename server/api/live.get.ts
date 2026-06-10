import { readdirSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

interface SessionFile {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  status: 'busy' | 'idle'
  updatedAt: number
}

export interface LiveSession {
  sessionId: string
  cwd: string
  project: string
  startedAt: number
  elapsedMs: number
  status: 'busy' | 'idle'
}

export default defineEventHandler((): LiveSession[] => {
  const sessionsDir = join(homedir(), '.claude', 'sessions')
  let files: string[]
  try {
    files = readdirSync(sessionsDir).filter(f => f.endsWith('.json'))
  } catch {
    return []
  }

  const now = Date.now()
  const results: LiveSession[] = []

  for (const file of files) {
    try {
      const raw = readFileSync(join(sessionsDir, file), 'utf8')
      const s = JSON.parse(raw) as SessionFile
      if (now - s.updatedAt > 60_000) continue
      results.push({
        sessionId: s.sessionId,
        cwd: s.cwd,
        project: basename(s.cwd),
        startedAt: s.startedAt,
        elapsedMs: now - s.startedAt,
        status: s.status,
      })
    } catch {
      // skip malformed files
    }
  }

  return results
})
