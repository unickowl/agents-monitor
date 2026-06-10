<!-- components/AppHeader.vue -->
<template>
  <header class="hd-outer">
    <div class="hd">
      <a class="hd-logo" href="#">owl monitor</a>
      <div class="hd-chips">
        <div v-for="s in liveSessions" :key="s.sessionId" class="chip">
          <span class="chip-dot"></span>
          {{ s.project }}
        </div>
      </div>
      <div class="hd-right">
        <span class="hd-date">{{ dateStr }}</span>
        <button class="theme-btn" :title="isDark ? 'Light mode' : 'Dark mode'" @click="toggleTheme">
          {{ isDark ? '○' : '◐' }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { LiveSession } from '~/server/api/live.get'

defineProps<{ liveSessions: LiveSession[] }>()

const isDark = ref(false)
const dateStr = new Date().toLocaleDateString('en-US', {
  weekday: 'short', month: 'short', day: 'numeric',
})

onMounted(() => {
  isDark.value = localStorage.getItem('theme') === 'dark'
  applyTheme()
})

function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  applyTheme()
}

function applyTheme() {
  document.documentElement.dataset.theme = isDark.value ? 'dark' : 'light'
}
</script>

<style scoped>
.hd-outer {
  position: sticky; top: 0; z-index: 50;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  transition: background .22s;
}

.hd {
  height: 52px;
  display: flex; align-items: center; gap: 12px;
}

.hd-logo {
  font-family: var(--mono);
  font-size: 12px; font-weight: 500;
  letter-spacing: .08em;
  color: var(--text); text-decoration: none;
  flex-shrink: 0; opacity: .88;
}

.hd-chips { display: flex; gap: 5px; flex: 1; overflow: hidden; }

.chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px 2px 6px;
  background: var(--live-bg);
  border: 1px solid var(--live-border);
  border-radius: 20px;
  font-family: var(--mono); font-size: 10.5px;
  color: var(--live); white-space: nowrap; flex-shrink: 0;
}

.chip-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--live);
  animation: pulse 1.8s ease-in-out infinite;
}

.hd-right { display: flex; align-items: center; gap: 14px; flex-shrink: 0; }

.hd-date { font-family: var(--mono); font-size: 11px; color: var(--muted); }

.theme-btn {
  background: none;
  border: 1px solid var(--border); border-radius: var(--r);
  padding: 4px 8px; cursor: pointer;
  color: var(--muted); font-size: 13px; line-height: 1;
  transition: .15s var(--ease);
}
.theme-btn:hover { border-color: var(--border-strong); color: var(--text); }
</style>
