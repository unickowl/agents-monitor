# agents-monitor

A local web dashboard for reviewing Claude Code and Codex agent session history. Designed for the pre-work morning ritual: open the dashboard, see what you worked on yesterday, decide where to pick up.

## Features

- **Session history** — Codex sessions pulled from `~/.codex/state_5.sqlite`, grouped by project with token count and duration
- **Live monitoring** — Claude Code active sessions detected from `~/.claude/sessions/*.json`, auto-refreshed every 10 seconds
- **7-day activity strip** — clickable day selector with stacked project bars; click any day to filter the session list
- **Sparklines** — per-project 7-day activity bars inline in each project header
- **Resume commands** — click any session row to expand its `cd <cwd> && codex resume <id>` command, copy with one click
- **Dark mode** — toggle persisted to `localStorage`

## Stack

Nuxt 3 (SPA mode) · Nitro server routes · better-sqlite3 · native CSS variables · Vitest

## Setup

```bash
npm install
npm run dev
```

Opens at `http://localhost:9527` (or your configured hostname).

## Data Sources

| Source | Path | Notes |
|--------|------|-------|
| Codex history | `~/.codex/state_5.sqlite` | table `threads` |
| Claude Code live | `~/.claude/sessions/*.json` | session considered live if `updatedAt` within 60s |

## Resume a Session

Expand any session row to copy its resume command:

```bash
cd /path/to/project && codex resume <uuid>
cd /path/to/project && claude --resume <sessionId>
```

## Project Structure

```
server/
  api/
    history.get.ts     # GET /api/history?since=7&project=<name>
    projects.get.ts    # GET /api/projects
    live.get.ts        # GET /api/live
  utils/
    db.ts              # SQLite singleton (read-only)
    transforms.ts      # Pure transform functions (tested)
composables/
  useMonitor.ts        # Reactive state, polling, day filter
components/
  AppHeader.vue        # Sticky header with live chips + theme toggle
  HeroBrief.vue        # Hero session count + stats
  DayStrip.vue         # 7-day clickable bar chart
  SessionGroup.vue     # Project group with sparkline + session rows
pages/
  index.vue
tests/
  transforms.test.ts   # Unit tests for pure functions
```

## Development

```bash
npm test        # run unit tests
npm run dev     # start dev server at port 9527
```
