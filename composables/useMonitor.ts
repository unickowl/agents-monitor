import type { HistorySession } from '~/server/utils/transforms'
import type { LiveSession } from '~/server/api/live.get'

function dayBounds(daysAgo: number): { start: number; end: number } {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  const start = d.getTime()
  d.setDate(d.getDate() + 1)
  return { start, end: d.getTime() }
}

export function useMonitor() {
  const liveSessions = useState<LiveSession[]>('live', () => [])
  const history = useState<HistorySession[]>('history', () => [])
  const selectedDay = useState<number>('selectedDay', () => 1)

  // Sessions for the currently selected day
  const dayHistory = computed<HistorySession[]>(() => {
    const { start, end } = dayBounds(selectedDay.value)
    return history.value.filter(s => s.startedAt >= start && s.startedAt < end)
  })

  // Per-project daily minutes across all 7 days — for sparklines
  const projDailyMinutes = computed<Record<string, number[]>>(() => {
    const result: Record<string, number[]> = {}
    for (const s of history.value) {
      if (!result[s.project]) result[s.project] = Array(7).fill(0)
      const sd = new Date(s.startedAt); sd.setHours(0, 0, 0, 0)
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const ago = Math.round((today.getTime() - sd.getTime()) / 86_400_000)
      const idx = 6 - Math.min(6, Math.max(0, ago))
      result[s.project][idx] += Math.round(s.durationMs / 60_000)
    }
    return result
  })

  async function refreshLive() {
    try {
      liveSessions.value = await $fetch<LiveSession[]>('/api/live')
    } catch {
      // non-fatal — keep previous value
    }
  }

  async function refreshHistory() {
    try {
      history.value = await $fetch<HistorySession[]>('/api/history', {
        params: { since: 7 },
      })
    } catch {
      // non-fatal — keep previous value
    }
  }

  let _interval: ReturnType<typeof setInterval> | null = null

  function startPolling() {
    refreshLive()
    _interval = setInterval(refreshLive, 10_000)
  }

  function stopPolling() {
    if (_interval) { clearInterval(_interval); _interval = null }
  }

  return {
    liveSessions,
    history,
    selectedDay,
    dayHistory,
    projDailyMinutes,
    refreshLive,
    refreshHistory,
    startPolling,
    stopPolling,
  }
}
