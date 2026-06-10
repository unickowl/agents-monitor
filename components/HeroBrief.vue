<!-- components/HeroBrief.vue -->
<template>
  <section class="brief">
    <div class="brief-nav">
      <button class="nav-btn" :disabled="selectedDay >= 6" @click="$emit('shift', -1)">←</button>
      <span class="period-label">{{ periodLabel }}</span>
      <button class="nav-btn" :disabled="selectedDay <= 0" @click="$emit('shift', 1)">→</button>
    </div>
    <div class="brief-hl">
      <span class="brief-n">{{ stats.sessionCount }}</span>
      <span class="brief-unit">sessions</span>
    </div>
    <div class="brief-sub">
      <span><span class="sub-val">{{ stats.projectCount }}</span> projects</span>
      <span><span class="sub-val">{{ stats.totalTime }}</span> total</span>
      <span><span class="sub-val">{{ stats.avgTime }}</span> avg</span>
      <span v-if="stats.longSessions > 0" class="warn-pill">
        ⚠ {{ stats.longSessions }} long sessions
      </span>
    </div>
    <div class="brief-sub2">
      <span>most active: <span class="sub2-accent">{{ stats.topProject }}</span></span>
      <span><span class="sub2-accent">{{ stats.totalTokens }}</span> tokens</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { HistorySession } from '~/server/utils/transforms'

const props = defineProps<{
  sessions: HistorySession[]
  selectedDay: number
}>()

defineEmits<{ shift: [delta: number] }>()

function fmtMs(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 1) return '0m'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

function fmtTokens(n: number): string {
  if (!n) return '0'
  if (n < 1000) return String(n)
  return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
}

const periodLabel = computed(() => {
  if (props.selectedDay === 0) return 'Today'
  if (props.selectedDay === 1) return 'Yesterday'
  const d = new Date()
  d.setDate(d.getDate() - props.selectedDay)
  const W = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return W[d.getDay()]
})

const stats = computed(() => {
  const ss = props.sessions
  if (!ss.length) {
    return { sessionCount: 0, projectCount: 0, totalTime: '0m', avgTime: '0m', longSessions: 0, topProject: '-', totalTokens: '0' }
  }
  const totalMs = ss.reduce((s, x) => s + x.durationMs, 0)
  const projCount = new Set(ss.map(s => s.project)).size
  const longSessions = ss.filter(s => s.durationMs > 3 * 60 * 60_000).length
  const totalTokens = ss.reduce((s, x) => s + x.tokensUsed, 0)
  const projTime: Record<string, number> = {}
  ss.forEach(s => { projTime[s.project] = (projTime[s.project] || 0) + s.durationMs })
  const topProject = Object.entries(projTime).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
  return {
    sessionCount: ss.length,
    projectCount: projCount,
    totalTime: fmtMs(totalMs),
    avgTime: fmtMs(totalMs / ss.length),
    longSessions,
    topProject,
    totalTokens: fmtTokens(totalTokens),
  }
})
</script>

<style scoped>
.brief { padding-top: 40px; padding-bottom: 28px; border-bottom: 1px solid var(--border); }

.brief-nav { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }

.nav-btn {
  background: none; border: none; cursor: pointer;
  color: var(--muted); font-size: 18px;
  padding: 0 4px; line-height: 1; border-radius: var(--r);
  transition: .12s var(--ease);
}
.nav-btn:hover:not(:disabled) { color: var(--text); background: var(--surface-2); }
.nav-btn:disabled { opacity: .2; cursor: default; }

.period-label {
  font-family: var(--mono); font-size: 11px;
  text-transform: uppercase; letter-spacing: .14em;
  color: var(--muted); min-width: 80px;
}

.brief-hl { display: flex; align-items: baseline; flex-wrap: wrap; line-height: 1; }

.brief-n {
  font-size: clamp(68px, 10vw, 116px);
  font-weight: 700; letter-spacing: -.045em;
  color: var(--text);
  font-feature-settings: 'tnum' 1;
  line-height: .88;
}

.brief-unit {
  font-size: clamp(24px, 3.2vw, 40px);
  font-weight: 300; color: var(--muted);
  margin-left: 12px; letter-spacing: -.015em;
}

.brief-sub {
  margin-top: 11px;
  font-family: var(--mono); font-size: 12.5px;
  color: var(--muted);
  display: flex; gap: 14px; flex-wrap: wrap; align-items: center;
}

.sub-val { color: var(--text); font-weight: 500; }

.brief-sub2 {
  margin-top: 6px;
  font-family: var(--mono); font-size: 11.5px;
  color: var(--faint);
  display: flex; gap: 14px; flex-wrap: wrap; align-items: center;
}

.sub2-accent { color: var(--muted); font-weight: 500; }

.warn-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 1px 8px;
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  border-radius: 20px;
  font-size: 11px; color: var(--warn);
}
</style>
