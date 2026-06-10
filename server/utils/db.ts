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
