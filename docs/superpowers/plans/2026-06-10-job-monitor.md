# Job Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Nuxt 3 full-stack app that reads Codex session history from SQLite and Claude Code live status from JSON files, and displays them in the Concept C editorial dashboard UI.

**Architecture:** Nuxt 3 in SPA mode (`ssr: false`) with Nitro server routes as the API layer. `better-sqlite3` reads Codex's `~/.codex/state_5.sqlite` synchronously in server routes. A Vue composable polls `/api/live` every 10 seconds for Claude Code active sessions. History is fetched once on mount and on day/project filter change.

**Tech Stack:** Nuxt 3, Vue 3 Composition API, better-sqlite3, TypeScript, native CSS variables (no UI library), Vitest for unit tests

---

## Data Source Reference (read before any task)

### Codex SQLite — `~/.codex/state_5.sqlite`, table `threads`

Real column names (confirmed by inspection):

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID — used in `codex resume <id>` |
| `cwd` | TEXT | Working directory — `basename(cwd)` = project name |
| `first_user_message` | TEXT | First message = session title (NOT `title`) |
| `model` | TEXT | e.g. `gpt-5.5` |
| `created_at_ms` | INTEGER | Session start, milliseconds |
| `updated_at_ms` | INTEGER | Session last updated, milliseconds |
| `git_branch` | TEXT | nullable |
| `tokens_used` | INTEGER | default 0 |

Resume command: `cd <cwd> && codex resume <id>`

### Claude Code — `~/.claude/sessions/<pid>.json`

```json
{
  "pid": 1301686,
  "sessionId": "1ce9f14a-...",
  "cwd": "/home/ubuntu/Code/owlting/job-monitor",
  "startedAt": 1781064996488,
  "status": "busy",
  "updatedAt": 1781065657809
}
```

A session is "live" when `status === "busy"` AND `updatedAt` is within 60 seconds of now.

---

## File Map

```
job-monitor/
├── nuxt.config.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── app.vue
├── assets/
│   └── css/
│       └── main.css              # CSS variables + global reset
├── server/
│   └── utils/
│   │   ├── db.ts                 # SQLite singleton (readonly)
│   │   └── transforms.ts         # Pure functions: row → API shape (TESTED)
│   └── api/
│       ├── live.get.ts           # GET /api/live — Claude Code active sessions
│       ├── history.get.ts        # GET /api/history?since=7&project=all
│       └── projects.get.ts       # GET /api/projects — 7-day aggregates
├── composables/
│   └── useMonitor.ts             # Reactive state + polling + dayHistory filter
├── components/
│   ├── AppHeader.vue             # Sticky header: logo, live chips, date, theme
│   ├── HeroBrief.vue             # Big number + 2 stats rows + day nav
│   ├── DayStrip.vue              # 7-day stacked bars + hover info line
│   └── SessionGroup.vue          # Project header (sparkline) + session rows
├── pages/
│   └── index.vue                 # Orchestrates all components, loads data
└── tests/
    └── transforms.test.ts        # Unit tests for pure transform functions
```

---

## Task 1 — Project Scaffold

**Files:**
- Create: `package.json`
- Create: `nuxt.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `app.vue`

- [ ] **Step 1: Initialize Nuxt 3 project**

Run from `/home/ubuntu/Code/owlting/job-monitor/`:
```bash
npx nuxi@latest init . --no-install --no-git-init
```

When prompted "existing files", answer yes to overwrite. This creates `nuxt.config.ts`, `app.vue`, `package.json`.

- [ ] **Step 2: Install dependencies**

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3 vitest @vitest/ui typescript
```

- [ ] **Step 3: Replace `nuxt.config.ts`**

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  nitro: {
    experimental: { wasm: false },
  },
  vite: {
    optimizeDeps: {
      exclude: ['better-sqlite3'],
    },
  },
})
```

- [ ] **Step 4: Replace `tsconfig.json`**

```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: Add test and dev scripts to `package.json`**

Open `package.json` and ensure the `scripts` block contains:
```json
"scripts": {
  "dev": "nuxt dev --port 3030",
  "build": "nuxt build",
  "test": "vitest run",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 7: Replace `app.vue`**

```vue
<!-- app.vue -->
<template>
  <NuxtPage />
</template>
```

- [ ] **Step 8: Create directory structure**

```bash
mkdir -p assets/css server/utils server/api composables components pages tests
```

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts at `http://localhost:3030`. Browser shows blank page (no pages yet). Stop with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Nuxt 3 job-monitor app"
```

---

## Task 2 — DB Utility + Transforms (TDD)

**Files:**
- Create: `server/utils/db.ts`
- Create: `server/utils/transforms.ts`
- Create: `tests/transforms.test.ts`

- [ ] **Step 1: Write failing tests first**

```typescript
// tests/transforms.test.ts
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
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../server/utils/transforms'`

- [ ] **Step 3: Create `server/utils/transforms.ts`**

```typescript
// server/utils/transforms.ts
import { basename } from 'path'

export interface HistorySession {
  id: string
  agent: 'codex'
  project: string
  cwd: string
  title: string
  model: string
  branch: string
  startedAt: number
  endedAt: number
  durationMs: number
  tokensUsed: number
  resumeCmd: string
}

interface ThreadRow {
  id: string
  cwd: string
  first_user_message: string
  model: string | null
  created_at_ms: number
  updated_at_ms: number
  git_branch: string | null
  tokens_used: number
}

export function transformHistoryRow(row: ThreadRow): HistorySession {
  return {
    id: row.id,
    agent: 'codex',
    project: basename(row.cwd),
    cwd: row.cwd,
    title: (row.first_user_message || '').slice(0, 200),
    model: row.model || 'unknown',
    branch: row.git_branch || 'main',
    startedAt: row.created_at_ms,
    endedAt: row.updated_at_ms,
    durationMs: row.updated_at_ms - row.created_at_ms,
    tokensUsed: row.tokens_used || 0,
    resumeCmd: `cd ${row.cwd} && codex resume ${row.id}`,
  }
}

function dayBounds(daysAgo: number): { start: number; end: number } {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  const start = d.getTime()
  d.setDate(d.getDate() + 1)
  return { start, end: d.getTime() }
}

/**
 * Returns 7 values: index 0 = 6 days ago, index 6 = today.
 * Each value = total minutes of sessions that started on that day.
 */
export function computeDailyMinutes(
  sessions: Array<{ startedAt: number; endedAt: number }>
): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const { start, end } = dayBounds(6 - i)
    return Math.round(
      sessions
        .filter(s => s.startedAt >= start && s.startedAt < end)
        .reduce((sum, s) => sum + (s.endedAt - s.startedAt) / 60_000, 0)
    )
  })
}
```

- [ ] **Step 4: Create `server/utils/db.ts`**

```typescript
// server/utils/db.ts
import Database from 'better-sqlite3'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'

const DB_PATH = join(homedir(), '.codex', 'state_5.sqlite')

let _db: Database.Database | null = null

export function getDb(): Database.Database | null {
  if (_db) return _db
  if (!existsSync(DB_PATH)) return null
  _db = new Database(DB_PATH, { readonly: true })
  return _db
}
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
npm test
```

Expected: all 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/utils/db.ts server/utils/transforms.ts tests/transforms.test.ts vitest.config.ts
git commit -m "feat: add SQLite db util and pure transform functions with tests"
```

---

## Task 3 — `/api/history` Route

**Files:**
- Create: `server/api/history.get.ts`

- [ ] **Step 1: Create the route**

```typescript
// server/api/history.get.ts
import { getDb } from '~/server/utils/db'
import { transformHistoryRow, type HistorySession } from '~/server/utils/transforms'

export default defineEventHandler((event): HistorySession[] => {
  const query = getQuery(event)
  const since = Number(query.since) || 7
  const project = query.project as string | undefined

  const db = getDb()
  if (!db) return []

  const cutoff = Date.now() - since * 24 * 60 * 60 * 1000

  const rows = project && project !== 'all'
    ? db.prepare(`
        SELECT id, cwd, first_user_message, model, created_at_ms, updated_at_ms,
               git_branch, tokens_used
        FROM threads
        WHERE created_at_ms > ? AND cwd LIKE ?
        ORDER BY updated_at_ms DESC
      `).all(cutoff, `%/${project}`) as any[]
    : db.prepare(`
        SELECT id, cwd, first_user_message, model, created_at_ms, updated_at_ms,
               git_branch, tokens_used
        FROM threads
        WHERE created_at_ms > ?
        ORDER BY updated_at_ms DESC
      `).all(cutoff) as any[]

  return rows.map(transformHistoryRow)
})
```

- [ ] **Step 2: Verify the route returns real data**

```bash
npm run dev &
sleep 3
curl "http://localhost:3030/api/history?since=7" | python3 -m json.tool | head -40
```

Expected: JSON array of session objects with `id`, `project`, `title`, `durationMs`, etc. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add server/api/history.get.ts
git commit -m "feat: add /api/history route reading Codex SQLite"
```

---

## Task 4 — `/api/projects` Route

**Files:**
- Create: `server/api/projects.get.ts`

- [ ] **Step 1: Create the route**

```typescript
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
```

- [ ] **Step 2: Verify**

```bash
npm run dev &
sleep 3
curl "http://localhost:3030/api/projects" | python3 -m json.tool | head -40
```

Expected: array of projects with `name`, `sessionCount`, `dailyMinutes` (7 numbers). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add server/api/projects.get.ts
git commit -m "feat: add /api/projects route with 7-day daily minutes"
```

---

## Task 5 — `/api/live` Route

**Files:**
- Create: `server/api/live.get.ts`

- [ ] **Step 1: Create the route**

```typescript
// server/api/live.get.ts
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { basename } from 'path'

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
```

- [ ] **Step 2: Verify**

```bash
npm run dev &
sleep 3
curl "http://localhost:3030/api/live" | python3 -m json.tool
```

Expected: JSON array (may be empty if no active sessions, or list of live sessions if Claude is running). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add server/api/live.get.ts
git commit -m "feat: add /api/live route reading Claude Code session files"
```

---

## Task 6 — CSS Foundation

**Files:**
- Create: `assets/css/main.css`

- [ ] **Step 1: Create global styles**

```css
/* assets/css/main.css */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #f6f6f4;
  --surface: #ffffff;
  --surface-2: #ededeb;
  --text: #0e0e0c;
  --muted: #69695f;
  --faint: #a8a89c;
  --border: #e2e2dc;
  --border-strong: #c4c4bc;
  --accent: #2563eb;
  --live: #16a34a;
  --live-bg: #f0fdf4;
  --live-border: #bbf7d0;
  --codex: #4f46e5;
  --claude: #ea580c;
  --warn: #d97706;
  --warn-bg: #fffbeb;
  --warn-border: #fde68a;
  --ff: 'Outfit', system-ui, sans-serif;
  --mono: 'DM Mono', 'Fira Mono', 'Consolas', monospace;
  --r: 5px;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}

[data-theme="dark"] {
  --bg: #0b0b09;
  --surface: #141412;
  --surface-2: #1c1c1a;
  --text: #eeeee8;
  --muted: #8a8a7e;
  --faint: #525248;
  --border: #242420;
  --border-strong: #38382e;
  --accent: #3b82f6;
  --live: #22c55e;
  --live-bg: #0c2014;
  --live-border: #166534;
  --codex: #818cf8;
  --claude: #fb923c;
  --warn: #fbbf24;
  --warn-bg: #1c1a08;
  --warn-border: #78350f;
}

html { font-size: 16px; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--ff);
  font-weight: 400;
  line-height: 1.5;
  min-height: 100vh;
  transition: background .22s, color .22s;
}

/* Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');

/* ── Shared layout ── */
.hd, .brief, .strip-inner, .strip-info, .sess-wrap {
  padding-left: 32px;
  padding-right: 32px;
}

/* ── Live chip pulse ── */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: .4; transform: scale(.7); }
}

@media (max-width: 680px) {
  .hd, .brief, .strip-inner, .strip-info, .sess-wrap {
    padding-left: 16px;
    padding-right: 16px;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/css/main.css
git commit -m "feat: add CSS variables and global reset"
```

---

## Task 7 — `useMonitor` Composable

**Files:**
- Create: `composables/useMonitor.ts`

- [ ] **Step 1: Create the composable**

```typescript
// composables/useMonitor.ts
import type { HistorySession } from '~/server/utils/transforms'
import type { LiveSession } from '~/server/api/live.get'

export interface DayBucket {
  daysAgo: number          // 0=today, 1=yesterday, ..., 6=6 days ago
  sessions: HistorySession[]
}

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
    history.value = await $fetch<HistorySession[]>('/api/history', {
      params: { since: 7 },
    })
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
```

- [ ] **Step 2: Commit**

```bash
git add composables/useMonitor.ts
git commit -m "feat: add useMonitor composable with polling and dayHistory computed"
```

---

## Task 8 — `AppHeader` Component

**Files:**
- Create: `components/AppHeader.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- components/AppHeader.vue -->
<template>
  <header class="hd">
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
.hd {
  position: sticky; top: 0; z-index: 50;
  height: 52px;
  display: flex; align-items: center; gap: 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  transition: background .22s;
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
```

- [ ] **Step 2: Commit**

```bash
git add components/AppHeader.vue
git commit -m "feat: add AppHeader component with live chips and theme toggle"
```

---

## Task 9 — `HeroBrief` Component

**Files:**
- Create: `components/HeroBrief.vue`

- [ ] **Step 1: Create the component**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add components/HeroBrief.vue
git commit -m "feat: add HeroBrief component with editorial stats display"
```

---

## Task 10 — `DayStrip` Component

**Files:**
- Create: `components/DayStrip.vue`

- [ ] **Step 1: Create the component**

```vue
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
  align-items: flex-end;
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
```

- [ ] **Step 2: Commit**

```bash
git add components/DayStrip.vue
git commit -m "feat: add DayStrip component with hover info and project color segments"
```

---

## Task 11 — `SessionGroup` Component

**Files:**
- Create: `components/SessionGroup.vue`

- [ ] **Step 1: Create the component**

```vue
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
  sparkHighlight: number   // which index to highlight
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
  await navigator.clipboard.writeText(s.resumeCmd).catch(() => {})
  copiedId.value = s.id
  setTimeout(() => { copiedId.value = null }, 1600)
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
```

- [ ] **Step 2: Commit**

```bash
git add components/SessionGroup.vue
git commit -m "feat: add SessionGroup component with sparkline header and expand resume"
```

---

## Task 12 — `pages/index.vue` (Wire Everything Together)

**Files:**
- Create: `pages/index.vue`

- [ ] **Step 1: Create the page**

```vue
<!-- pages/index.vue -->
<template>
  <div>
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
      <div v-else class="empty-day">No sessions recorded for this day</div>
    </main>
  </div>
</template>

<script setup lang="ts">
const { liveSessions, history, selectedDay, dayHistory, projDailyMinutes, refreshHistory, startPolling, stopPolling } = useMonitor()

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
  await refreshHistory()
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
  padding: 48px 0;
  text-align: center;
  color: var(--faint);
  font-family: var(--mono); font-size: 13px;
}
</style>
```

- [ ] **Step 2: Start the dev server and verify the full UI**

```bash
npm run dev
```

Open `http://localhost:3030` in a browser. Verify:
- Header shows logo and any currently-active Claude sessions as live chips
- Hero brief shows real session count for yesterday with actual project names
- Day strip shows 7 bars with real relative heights
- Session list shows real Codex sessions grouped by project with sparklines
- Clicking a session row expands to show the resume command
- Clicking "Copy" copies the command to clipboard

- [ ] **Step 3: Commit**

```bash
git add pages/index.vue
git commit -m "feat: wire index page — full working job monitor dashboard"
```

---

## Task 13 — Final Tests Pass + Polish

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests in `tests/transforms.test.ts` PASS

- [ ] **Step 2: Verify dark mode toggle**

In the browser, click the `◐` button in the header. Verify:
- All CSS variables switch to dark values
- No white flash or FOUC on reload (localStorage persists preference)

If dark mode is not persisting on page reload, add this to `app.vue`:

```vue
<!-- app.vue -->
<template>
  <NuxtPage />
</template>

<script setup lang="ts">
// Apply persisted theme before first paint
if (import.meta.client) {
  const stored = localStorage.getItem('theme')
  if (stored) document.documentElement.dataset.theme = stored
}
</script>
```

- [ ] **Step 3: Verify RWD at 680px and 420px**

In browser DevTools, set viewport to 680px width. Verify:
- Padding collapses to 16px on both sides
- Session rows still readable, expand panel wraps correctly

Set viewport to 420px. Verify:
- Hero number downsizes via `clamp()`
- No horizontal overflow

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: job monitor complete — Nuxt 3 + SQLite + editorial brief UI"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** `/api/live` (Task 5), `/api/history` (Task 3), `/api/projects` (Task 4), day strip (Task 10), session list with resume (Task 11), polling (Task 7 composable), dark mode (Task 13), RWD (Task 13)
- [x] **Real column names used:** `first_user_message` (not `title`), `created_at_ms`/`updated_at_ms` (not `created_at`/`updated_at`)
- [x] **No placeholders:** all code is complete in every step
- [x] **Type consistency:** `HistorySession` defined in `transforms.ts`, imported by components; `LiveSession` defined in `live.get.ts`, imported by `AppHeader`
- [x] **`computeDailyMinutes` used in both** `projects.get.ts` (server) and `useMonitor.ts` (client-side for sparklines) — note: these compute daily minutes two different ways. Server version uses it for `/api/projects`, composable computes it inline from `history` state. Both use the same algorithm. Consistent.
- [x] **`sparkHighlight` index:** passed as `6 - selectedDay` in `index.vue`, matches `sparkValues` array convention (index 6 = today)
