<!-- components/SessionGroup.vue -->
<template>
  <div class="proj-grp">
    <div class="proj-hd">
      <span class="proj-hd-name" :style="{ color: projColor }">{{ project }}</span>
      <span class="proj-hd-stats">{{ sessions.length }} sessions · {{ totalDurStr }}</span>
      <span class="proj-spark">
        <span
          v-for="(v, i) in sparkValues"
          :key="i"
          class="sp-bar"
          :style="{
            height: spH(v) + 'px',
            background: projColor,
            opacity: i === sparkHighlight ? 1 : v > 0 ? 0.48 : 0.15,
          }"
        ></span>
      </span>
      <span class="proj-hd-line"></span>
    </div>
    <div
      v-for="s in sessions"
      :key="s.id"
      class="sess-row"
      :class="{ open: openIds.has(s.id) }"
      @click="toggle(s.id)"
    >
      <div class="sess-time">{{ fmtTime(s.startedAt) }}</div>
      <div class="sess-body">
        <div class="sess-title">{{ s.title || '(no title)' }}</div>
        <div class="sess-meta">
          <span class="agent-dot" :class="s.agent"></span>
          <span class="meta-tag">{{ s.agent }}</span>
          <span class="meta-sep">·</span>
          <span class="meta-tag">{{ s.branch }}</span>
          <span class="meta-sep">·</span>
          <span class="meta-tag">{{ s.model }}</span>
          <span v-if="s.tokensUsed > 0">
            <span class="meta-sep">·</span>
            <span class="meta-tag">{{ fmtTkn(s.tokensUsed) }} tkn</span>
          </span>
        </div>
      </div>
      <div class="sess-dur-col">
        <div class="dur-track">
          <div class="dur-fill" :style="{ width: durPct(s) + '%', background: projColor }"></div>
        </div>
        <div class="sess-dur">{{ fmtDur(s.durationMs) }}</div>
      </div>
      <div class="sess-expand">
        <div class="expand-inner">
          <div class="resume-code">{{ s.resumeCmd }}</div>
          <button
            class="copy-btn"
            :class="{ ok: copiedId === s.id }"
            @click.stop="copy(s)"
          >{{ copiedId === s.id ? 'Copied' : 'Copy' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { HistorySession } from '~/server/utils/transforms'

const props = defineProps<{
  project: string
  sessions: HistorySession[]
  projColor: string
  sparkValues: number[]    // 7 daily minute totals (index 0=6 days ago, 6=today)
  sparkHighlight: number   // which index to highlight (6 - selectedDay)
}>()

const openIds = ref(new Set<string>())
const copiedId = ref<string | null>(null)

const maxDur = computed(() => Math.max(...props.sessions.map(s => s.durationMs), 1))
const spMax = computed(() => Math.max(...props.sparkValues, 1))

const totalDurStr = computed(() => {
  const ms = props.sessions.reduce((s, x) => s + x.durationMs, 0)
  return fmtDur(ms)
})

function spH(v: number): number {
  return v === 0 ? 1.5 : Math.max(2, Math.round((v / spMax.value) * 13))
}

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function fmtDur(ms: number): string {
  const m = Math.round(ms / 60_000)
  if (m < 1) return '<1m'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

function fmtTkn(n: number): string {
  return n < 1000 ? String(n) : (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
}

function durPct(s: HistorySession): number {
  return Math.max(6, Math.round((s.durationMs / maxDur.value) * 100))
}

function toggle(id: string) {
  openIds.value.has(id) ? openIds.value.delete(id) : openIds.value.add(id)
}

async function copy(s: HistorySession) {
  const text = s.resumeCmd
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text).catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
  copiedId.value = s.id
  setTimeout(() => { copiedId.value = null }, 1600)
}

function fallbackCopy(text: string) {
  const el = document.createElement('textarea')
  el.value = text
  el.style.cssText = 'position:fixed;opacity:0'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}
</script>

<style scoped>
.proj-grp { padding-top: 28px; padding-bottom: 2px; }

.proj-hd {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 2px;
}

.proj-hd-name {
  font-family: var(--mono); font-size: 10px;
  text-transform: uppercase; letter-spacing: .14em;
  flex-shrink: 0;
}

.proj-hd-stats {
  font-family: var(--mono); font-size: 10px;
  color: var(--faint); flex-shrink: 0; white-space: nowrap;
}

.proj-spark {
  display: inline-flex; align-items: flex-end;
  gap: 1.5px; height: 14px; flex-shrink: 0;
}

.sp-bar { width: 3px; border-radius: 1px; min-height: 1.5px; }

.proj-hd-line { flex: 1; height: 1px; background: var(--border); }

/* Session rows */
.sess-row {
  display: grid;
  grid-template-columns: 50px 1fr auto;
  column-gap: 14px;
  padding: 11px 8px;
  margin: 0 -8px;
  cursor: pointer;
  border-radius: var(--r);
  border-top: 1px solid transparent;
  transition: background .12s var(--ease);
}

.sess-row + .sess-row { border-top-color: var(--border); }
.sess-row:hover, .sess-row.open { background: var(--surface); border-top-color: transparent; }
.sess-row:hover + .sess-row, .sess-row.open + .sess-row { border-top-color: transparent; }

.sess-time {
  font-family: var(--mono); font-size: 11.5px;
  color: var(--muted); padding-top: 1px; grid-row: 1;
}

.sess-body { min-width: 0; grid-row: 1; }

.sess-title {
  font-size: 14.5px; font-weight: 500;
  color: var(--text); line-height: 1.4;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.sess-meta { display: flex; align-items: center; gap: 5px; margin-top: 3px; flex-wrap: wrap; }

.agent-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.agent-dot.codex { background: var(--codex); }
.agent-dot.claude { background: var(--claude); }

.meta-tag { font-family: var(--mono); font-size: 10.5px; color: var(--faint); }
.meta-sep { font-size: 9px; color: var(--border-strong); }

.sess-dur-col { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; grid-row: 1; padding-top: 2px; }

.dur-track { width: 44px; height: 2.5px; background: var(--border); border-radius: 2px; overflow: hidden; }
.dur-fill { height: 100%; border-radius: 2px; opacity: .7; transition: width .3s var(--ease); }

.sess-dur { font-family: var(--mono); font-size: 11.5px; color: var(--muted); text-align: right; white-space: nowrap; }

/* Expand */
.sess-expand { grid-column: 1 / -1; grid-row: 2; max-height: 0; overflow: hidden; transition: max-height .26s var(--ease); }
.sess-row.open .sess-expand { max-height: 72px; }

.expand-inner { padding: 8px 0 4px 64px; display: flex; align-items: center; gap: 8px; }

.resume-code {
  font-family: var(--mono); font-size: 10.5px; color: var(--muted);
  background: var(--surface-2); border: 1px solid var(--border);
  border-radius: var(--r); padding: 5px 10px;
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}

.copy-btn {
  font-family: var(--mono); font-size: 10.5px;
  padding: 5px 12px; background: var(--text); color: var(--bg);
  border: none; border-radius: var(--r); cursor: pointer; flex-shrink: 0;
  transition: .12s var(--ease);
}
.copy-btn:hover { opacity: .82; }
.copy-btn:active { transform: scale(.96); }
.copy-btn.ok { background: var(--live); }

@media (max-width: 680px) {
  .expand-inner { padding-left: 0; flex-wrap: wrap; }
}
</style>
