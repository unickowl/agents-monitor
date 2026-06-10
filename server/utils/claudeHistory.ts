import { readdirSync, readFileSync, statSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'
import type { HistorySession } from './transforms'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

export function parseClaudeSessions(since: number): HistorySession[] {
  const cutoff = Date.now() - since * 24 * 60 * 60 * 1000
  const results: HistorySession[] = []

  let projDirs: string[]
  try { projDirs = readdirSync(PROJECTS_DIR) } catch { return [] }

  for (const projDir of projDirs) {
    let files: string[]
    try {
      files = readdirSync(join(PROJECTS_DIR, projDir)).filter(f => f.endsWith('.jsonl'))
    } catch { continue }

    for (const file of files) {
      const filePath = join(PROJECTS_DIR, projDir, file)
      try {
        if (statSync(filePath).mtimeMs < cutoff) continue

        const lines = readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim())

        let sessionId = ''
        let cwd = ''
        let branch = 'main'
        let firstTs = 0
        let lastTs = 0
        let title = ''
        let model = 'claude'
        let tokensUsed = 0

        for (const line of lines) {
          try {
            const d = JSON.parse(line)

            if (!sessionId && d.sessionId) sessionId = d.sessionId
            if (!cwd && d.cwd) cwd = d.cwd
            if (d.gitBranch && d.gitBranch !== 'HEAD') branch = d.gitBranch

            if (d.timestamp) {
              const ts = new Date(d.timestamp).getTime()
              if (!firstTs || ts < firstTs) firstTs = ts
              if (ts > lastTs) lastTs = ts
            }

            if (!title && d.type === 'user' && d.message?.content) {
              const content = d.message.content
              const text = typeof content === 'string'
                ? content
                : Array.isArray(content)
                  ? (content.find((c: any) => c.type === 'text')?.text ?? '')
                  : ''
              if (text && !text.startsWith('<local-command')) title = text.slice(0, 200)
            }

            if (d.type === 'assistant' && d.message) {
              if (d.message.model) model = d.message.model
              if (d.message.usage) tokensUsed += (d.message.usage.output_tokens ?? 0)
            }
          } catch { /* skip malformed lines */ }
        }

        if (!sessionId || !firstTs || firstTs < cutoff) continue

        results.push({
          id: sessionId,
          agent: 'claude',
          project: basename(cwd),
          cwd,
          title,
          model,
          branch,
          startedAt: firstTs,
          endedAt: lastTs || firstTs,
          durationMs: (lastTs || firstTs) - firstTs,
          tokensUsed,
          resumeCmd: `cd ${cwd} && claude --resume ${sessionId}`,
        })
      } catch { /* skip unreadable files */ }
    }
  }

  return results.sort((a, b) => b.startedAt - a.startedAt)
}
