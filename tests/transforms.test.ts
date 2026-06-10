import { describe, it, expect } from 'vitest'
import { transformHistoryRow, computeDailyMinutes } from '../server/utils/transforms'

describe('transformHistoryRow', () => {
  it('extracts project name from cwd', () => {
    const row = {
      id: 'abc-123',
      cwd: '/home/ubuntu/Code/owlting/harbor',
      first_user_message: 'Fix the auth bug',
      model: 'gpt-5.5',
      created_at_ms: 1_000_000_000,
      updated_at_ms: 1_000_000_000 + 3_600_000,
      git_branch: 'main',
      tokens_used: 5000,
    }
    const result = transformHistoryRow(row)
    expect(result.project).toBe('harbor')
    expect(result.agent).toBe('codex')
    expect(result.durationMs).toBe(3_600_000)
    expect(result.resumeCmd).toBe('cd /home/ubuntu/Code/owlting/harbor && codex resume abc-123')
    expect(result.tokensUsed).toBe(5000)
  })

  it('truncates title to 200 characters', () => {
    const row = {
      id: 'x',
      cwd: '/a/b/proj',
      first_user_message: 'a'.repeat(300),
      model: null,
      created_at_ms: 1000,
      updated_at_ms: 2000,
      git_branch: null,
      tokens_used: 0,
    }
    const result = transformHistoryRow(row)
    expect(result.title.length).toBe(200)
    expect(result.branch).toBe('main')
    expect(result.model).toBe('unknown')
    expect(result.project).toBe('proj')
  })

  it('handles empty first_user_message', () => {
    const row = {
      id: 'y',
      cwd: '/a/b',
      first_user_message: '',
      model: 'gpt-5.5',
      created_at_ms: 1000,
      updated_at_ms: 1000,
      git_branch: 'feat/thing',
      tokens_used: 100,
    }
    const result = transformHistoryRow(row)
    expect(result.title).toBe('')
    expect(result.durationMs).toBe(0)
  })
})

describe('computeDailyMinutes', () => {
  it('returns exactly 7 values', () => {
    const result = computeDailyMinutes([])
    expect(result).toHaveLength(7)
    expect(result.every(v => v === 0)).toBe(true)
  })

  it('places a session from today into index 6', () => {
    const now = new Date()
    now.setHours(10, 0, 0, 0) // 10am today
    const sessions = [{
      startedAt: now.getTime(),
      endedAt: now.getTime() + 30 * 60_000, // 30 minutes
    }]
    const result = computeDailyMinutes(sessions)
    expect(result[6]).toBe(30)
    expect(result[5]).toBe(0)
  })

  it('places a session from yesterday into index 5', () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    d.setHours(14, 0, 0, 0)
    const sessions = [{
      startedAt: d.getTime(),
      endedAt: d.getTime() + 60 * 60_000, // 60 minutes
    }]
    const result = computeDailyMinutes(sessions)
    expect(result[5]).toBe(60)
    expect(result[6]).toBe(0)
  })

  it('ignores sessions older than 6 days', () => {
    const d = new Date()
    d.setDate(d.getDate() - 10)
    const sessions = [{
      startedAt: d.getTime(),
      endedAt: d.getTime() + 60 * 60_000,
    }]
    const result = computeDailyMinutes(sessions)
    expect(result.every(v => v === 0)).toBe(true)
  })
})
