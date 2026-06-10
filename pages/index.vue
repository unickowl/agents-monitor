<!-- pages/index.vue -->
<template>
  <div>
    <TheLoader :done="loaded" />

    <AppHeader :live-sessions="liveSessions" />

    <HeroBrief
      :sessions="dayHistory"
      :selected-day="selectedDay"
      @shift="delta => selectedDay = Math.min(6, Math.max(0, selectedDay + delta))"
    />

    <DayStrip
      :all-history="history"
      :selected-day="selectedDay"
      @select="d => (selectedDay = d)"
    />

    <main class="sess-wrap">
      <template v-if="groupedSessions.length">
        <SessionGroup
          v-for="[proj, ss] in groupedSessions"
          :key="proj"
          :project="proj"
          :sessions="ss"
          :proj-color="projColor(proj)"
          :spark-values="projDailyMinutes[proj] || Array(7).fill(0)"
          :spark-highlight="6 - selectedDay"
        />
      </template>
      <div v-else class="empty-day">
        <div class="empty-rule"></div>
        <span class="empty-label">No sessions recorded</span>
        <div class="empty-rule"></div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { liveSessions, history, selectedDay, dayHistory, projDailyMinutes, refreshHistory, startPolling, stopPolling } = useMonitor()

const loaded = ref(false)

const COLOR_PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#f97316']

const projColorMap = computed(() => {
  const map: Record<string, string> = {}
  const projs = [...new Set(history.value.map(s => s.project))]
  projs.forEach((p, i) => { map[p] = COLOR_PALETTE[i % COLOR_PALETTE.length] })
  return map
})

function projColor(p: string): string { return projColorMap.value[p] || '#888' }

const groupedSessions = computed((): [string, typeof dayHistory.value][] => {
  const grps: Record<string, typeof dayHistory.value> = {}
  dayHistory.value.forEach(s => { (grps[s.project] || (grps[s.project] = [])).push(s) })
  return Object.entries(grps)
})

onMounted(async () => {
  await Promise.all([
    refreshHistory(),
    new Promise(r => setTimeout(r, 1400)),
  ])
  loaded.value = true
  startPolling()
})

onUnmounted(() => stopPolling())
</script>

<style>
.sess-wrap {
  padding-bottom: 96px;
  max-width: 960px;
}

.empty-day {
  padding: 56px 0;
  display: flex; align-items: center; gap: 20px;
}

.empty-rule {
  flex: 1; height: 1px; background: var(--border);
}

.empty-label {
  font-family: var(--mono); font-size: 10.5px;
  text-transform: uppercase; letter-spacing: .14em;
  color: var(--faint); white-space: nowrap; flex-shrink: 0;
}
</style>
