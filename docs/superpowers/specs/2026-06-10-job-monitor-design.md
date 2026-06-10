# Job Monitor — Design Spec

**Date:** 2026-06-10  
**Status:** Approved

---

## Purpose

A local web dashboard that lets the user monitor Claude Code and Codex agent sessions globally — both live activity and historical sessions. Primary use case: **pre-work review** before starting the day, to quickly understand what was done recently and where to pick up. Secondary use case: **ambient monitoring** to see if any agents are currently running.

---

## Data Sources

### Codex — `~/.codex/state_5.sqlite`, table: `threads`

Key columns:
- `id` — session UUID (used for `codex resume <id>`)
- `cwd` — working directory
- `title` — first user message (used as session summary)
- `model` — model used (e.g. `gpt-5.5`)
- `created_at_ms`, `updated_at_ms` — millisecond timestamps
- `git_branch` — active branch at session start
- `git_origin_url` — remote URL
- `tokens_used` — total tokens (proxy for work volume)

Sessions with no `ended_at` (or `updated_at` very recent) are treated as potentially running. There is no explicit status field — liveness is inferred from Claude Code sessions file.

### Claude Code — `~/.claude/sessions/*.json`

Each file is a small JSON object:
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

A session file existing with `status: "busy"` means Claude Code is currently active in that directory. This is the live signal for Claude Code sessions. Historical Claude Code sessions are available via per-project `.jsonl` files in `~/.claude/projects/`.

---

## Architecture

**Nuxt 3 full-stack** — server routes as API layer, Vue frontend as SPA. Single project, single `npm run dev`.

```
job-monitor/
├── server/
│   └── api/
│       ├── live.get.ts        # Active Claude Code sessions (reads ~/.claude/sessions/*.json)
│       ├── history.get.ts     # Historical sessions from Codex SQLite + Claude projects
│       └── projects.get.ts    # Project list with session counts and last-active time
├── pages/
│   └── index.vue              # Main dashboard page
├── components/
│   ├── ActivityChart.vue      # Stacked bar chart (7-day activity)
│   ├── DigestCard.vue         # Selected-day summary card
│   ├── SessionGroup.vue       # Project-grouped session rows
│   └── LiveChips.vue          # Header live session indicators
└── composables/
    └── useMonitor.ts          # Polling logic + state
```

**Dependencies:**
- `better-sqlite3` — synchronous SQLite reads in server routes (no async complexity)
- Nuxt 3 built-ins — `$fetch`, `useAsyncData`, `useState`
- No UI component library — custom CSS (matches the mockup aesthetic)

---

## API Routes

### `GET /api/live`

Reads all files in `~/.claude/sessions/`. Returns active Claude Code sessions.

```ts
// Response
[{
  sessionId: string,
  cwd: string,
  project: string,       // basename of cwd
  startedAt: number,     // ms timestamp
  elapsedMs: number,
  status: 'busy' | 'idle'
}]
```

No Codex live detection — Codex does not write a session-status file. Codex sessions with `updated_at` within the last 5 minutes are flagged as potentially active but not shown as definitively live.

### `GET /api/history?since=<days>&project=<name>`

**MVP scope: Codex sessions only.** Queries Codex `threads` table. Claude Code historical sessions (stored in `~/.claude/projects/<dir>/*.jsonl`) are complex to parse and excluded from v1 — Claude Code contributes only to the live status feed, not history.

Returns sessions sorted by `updated_at_ms` descending.

```ts
// Response
[{
  id: string,
  agent: 'codex' | 'claude',
  project: string,
  cwd: string,
  title: string,          // first user message, truncated to 200 chars
  model: string,
  branch: string,
  startedAt: number,
  endedAt: number | null,
  durationMs: number,
  tokensUsed: number,
  resumeCmd: string,      // ready-to-run: "cd <cwd> && codex resume <id>"
}]
```

`since` defaults to 7. `project` filters by cwd basename.

### `GET /api/projects`

Returns project list aggregated from `threads`, sorted by last activity.

```ts
[{
  name: string,
  cwd: string,
  sessionCount: number,
  lastActiveAt: number,
  dailyMinutes: number[],   // 7 values, index 0 = 7 days ago
}]
```

---

## UI Design

Approved design: **Concept B — Activity Dashboard** (see `concept-b.html`).

### Layout

```
┌─ Header ────────────────────────────────────────────────┐
│ Logo  [live chips]                    Date  [theme btn] │
├─ Chart section ─────────────────────────────────────────┤
│ 7-day stacked bar chart (clickable, drives content)     │
├─────────────────┬───────────────────────────────────────┤
│ Sidebar         │ Main content                          │
│ - Projects      │ - Digest card (selected day)          │
│   (sparklines)  │ - Session groups (by project)         │
│ - Agent filter  │                                       │
└─────────────────┴───────────────────────────────────────┘
```

### Activity Chart

- 7 columns (days), stacked bars per column
- Bar height proportional to total session time (minutes)
- Each segment = one project, color-coded
- Click column → selects day, content below filters + animates
- Default selected day: **yesterday**
- Hover tooltip: date + per-project breakdown

### Digest Card

Appears above session list for the selected day:
- Date label (Today / Yesterday / Jun N)
- Stats: session count, project count, total time
- Warning if any sessions > 60 min with no follow-up (potential unfinished work)

### Session Row

Each row shows:
- Time (HH:MM)
- Agent dot (Codex = indigo, Claude = orange)
- Task text — truncated to 2 lines
- Tags: branch, model, agent name
- Duration (right-aligned) — `running…` in green if live
- **Resume button** — copies `cd <cwd> && codex resume <id>` (or `claude --resume <id>`) to clipboard, shows `✓ Copied` feedback for 1.6s

### Sidebar Sparklines

Each project entry has a 7-bar mini sparkline showing relative daily activity. Height is proportional to session minutes that day.

### Theme

Light theme default, dark theme toggle. Preference persisted in `localStorage`. Toggle button in header.

### Polling

`/api/live` polled every **10 seconds** via `setInterval`. History data fetched once on load and on day/project filter change. No WebSocket — polling is sufficient for this use case.

---

## Resume Command Format

```bash
# Codex
cd /home/ubuntu/Code/owlting/harbor && codex resume 019eaabc-592d-7aa3-b920-69e178db420c

# Claude Code
cd /home/ubuntu/Code/owlting/harbor && claude --resume 175a0c83-839a-4fd1-b28f-aa8a9688c14c
```

The full command (including `cd`) is what gets copied to clipboard — no editing needed before pasting.

---

## Out of Scope

- Spawning terminal windows or launching agents from the browser
- Showing full conversation content (summaries only)
- Authentication or multi-user support
- Mobile layout
- Notifications / alerts
