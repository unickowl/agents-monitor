<!-- components/DayStrip.vue -->
<template>
  <section class="strip">
    <div class="strip-info">
      <span class="strip-info-text" :class="{ visible: hoverText }">{{ hoverText }}</span>
    </div>
    <div class="strip-inner">
      <div
        v-for="day in days"
        :key="day.daysAgo"
        class="strip-col"
        :class="{ on: day.daysAgo === selectedDay }"
        @click="$emit('select', day.daysAgo)"
        @mouseenter="hoverText = day.hoverInfo"
        @mouseleave="hoverText = ''"
      >
        <div class="strip-bar-wrap">
          <div class="strip-bar" :style="{ height: day.barH + 'px' }">
            <div
              v-for="seg in day.segments"
              :key="seg.project"
              class="strip-seg"
              :style="{ height: seg.h + 'px', background: seg.color, opacity: '0.72' }"
            ></div>
          </div>
        </div>
        <div class="strip-lbl">{{ day.label }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { HistorySession } from '~/server/utils/transforms'

const COLOR_PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316']

const props = defineProps<{
  allHistory: HistorySession[]
  selectedDay: number
}>()

defineEmits<{ select: [daysAgo: number] }>()

const hoverText = ref('')

const days = computed(() => {
  // Build stable project-to-color map from full history
  const projOrder: string[] = []
  props.allHistory.forEach(s => { if (!projOrder.includes(s.project)) projOrder.push(s.project) })
  const colorMap: Record<string, string> = {}
  projOrder.forEach((p, i) => { colorMap[p] = COLOR_PALETTE[i % COLOR_PALETTE.length] })

  // Bucket sessions by daysAgo
  const byDay: Record<number, HistorySession[]> = {}
  for (let i = 0; i <= 6; i++) byDay[i] = []

  props.allHistory.forEach(s => {
    const sd = new Date(s.startedAt); sd.setHours(0,0,0,0)
    const tod = new Date(); tod.setHours(0,0,0,0)
    const ago = Math.min(6, Math.max(0, Math.round((tod.getTime() - sd.getTime()) / 86_400_000)))
    byDay[ago].push(s)
  })

  const maxCount = Math.max(...Object.values(byDay).map(ss => ss.length), 1)
  const MAXH = 52

  return Array.from({ length: 7 }, (_, i) => {
    const ago = 6 - i          // i=0 → 6 days ago, i=6 → today
    const ss = byDay[ago] || []
    const barH = Math.max(4, Math.round((ss.length / maxCount) * MAXH))

    const pc: Record<string, number> = {}
    ss.forEach(s => { pc[s.project] = (pc[s.project] || 0) + 1 })
    const total = ss.length || 1

    const segments = Object.entries(pc)
      .sort((a, b) => b[1] - a[1])
      .map(([proj, count]) => ({
        project: proj,
        h: Math.max(1, Math.round((count / total) * barH)),
        color: colorMap[proj] || '#888',
      }))

    const totalMin = Math.round(ss.reduce((s, x) => s + x.durationMs, 0) / 60_000)
    const projCount = new Set(ss.map(s => s.project)).size
    const durStr = totalMin < 60 ? `${totalMin}m` : `${Math.floor(totalMin/60)}h ${totalMin%60}m`

    let label: string
    if (ago === 0) label = 'Today'
    else if (ago === 1) label = 'Yest'
    else {
      const d = new Date(); d.setDate(d.getDate() - ago)
      label = ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]
    }

    return {
      daysAgo: ago,
      barH,
      segments,
      label,
      hoverInfo: `${ss.length} sessions  ·  ${durStr}  ·  ${projCount} projects`,
    }
  })
})
</script>

<style scoped>
.strip { border-bottom: 1px solid var(--border); }

.strip-info {
  height: 28px;
  display: flex; align-items: center;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.strip-info-text {
  font-family: var(--mono); font-size: 11px;
  color: var(--muted);
  opacity: 0; transform: translateY(3px);
  transition: opacity .15s var(--ease), transform .15s var(--ease);
  white-space: nowrap;
}
.strip-info-text.visible { opacity: 1; transform: translateY(0); }

.strip-inner {
  display: flex; gap: 3px;
  align-items: stretch;
  padding-top: 12px; padding-bottom: 10px;
}

.strip-col {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  align-items: center; gap: 5px;
  cursor: pointer;
  padding: 4px 2px 0;
  border-radius: var(--r);
  transition: background .12s var(--ease);
}
.strip-col:hover { background: var(--surface-2); }

.strip-bar-wrap { flex: 1; display: flex; align-items: flex-end; width: 100%; }

.strip-bar {
  width: 100%;
  display: flex; flex-direction: column;
  border-radius: 3px; overflow: hidden;
  transition: opacity .2s var(--ease), outline .12s var(--ease);
}

.strip-seg { width: 100%; min-height: 1px; flex-shrink: 0; }

.strip-lbl {
  font-family: var(--mono); font-size: 9.5px;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--faint);
  transition: color .12s var(--ease);
}
.strip-col:hover .strip-lbl, .strip-col.on .strip-lbl { color: var(--muted); }

.strip-col.on .strip-bar { outline: 2px solid var(--accent); outline-offset: 1px; }

.strip-inner:has(.strip-col.on) .strip-col:not(.on) .strip-bar { opacity: .25; }
</style>
