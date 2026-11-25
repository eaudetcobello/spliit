#!/usr/bin/env node
/**
 * One-off import of a Postgres Spliit database into a freshly migrated SQLite
 * one. Kept for the record of how the homelab instance moved over.
 *
 *   node scripts/import-postgres-json.mjs <json-dir> <spliit.db>
 *
 * <json-dir> holds one `<Table>.json` per table, each the output of
 *   psql -tAc "select coalesce(json_agg(t), '[]') from \"<Table>\" t"
 * and <spliit.db> must already have the schema (`prisma migrate deploy`) and
 * no data besides the categories the baseline migration seeds.
 *
 * Values are converted by the SQLite column's declared type, to the form the
 * Prisma adapter writes: DATETIME as ISO-8601 text with a `+00:00` offset (a
 * Postgres DATE becoming UTC midnight), BOOLEAN as 0/1. Postgres timestamps
 * are `timestamp without time zone` holding UTC, so they are read as UTC.
 *
 * Run from a directory whose node_modules has better-sqlite3: the repository
 * locally, or /usr/app inside the published image.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(path.join(process.cwd(), 'noop.js'))
const Database = require('better-sqlite3')

// Parents before children, for the foreign keys.
const TABLES = [
  'Group',
  'Participant',
  'Expense',
  'ExpensePaidFor',
  'ExpenseDocument',
  'RecurringExpenseLink',
  'Activity',
]

const [jsonDir, dbPath] = process.argv.slice(2)
if (!jsonDir || !dbPath) {
  console.error('usage: import-postgres-json.mjs <json-dir> <spliit.db>')
  process.exit(2)
}

const readTable = (table) =>
  JSON.parse(readFileSync(path.join(jsonDir, `${table}.json`), 'utf8'))

function toTimestamp(value) {
  if (value === null) return null
  // DATE columns come out as `2023-05-12`, timestamps without an offset.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00Z`
    : /(Z|[+-]\d{2}:?\d{2})$/.test(value)
      ? value
      : `${value}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new Error(`Bad timestamp: ${value}`)
  return date.toISOString().replace('Z', '+00:00')
}

function convert(value, type) {
  if (value === null || value === undefined) return null
  if (type === 'DATETIME') return toTimestamp(value)
  if (type === 'BOOLEAN') return value ? 1 : 0
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

const db = new Database(dbPath, { fileMustExist: true })
db.pragma('foreign_keys = ON')

const columnTypes = (table) =>
  Object.fromEntries(
    db
      .prepare(`PRAGMA table_info("${table}")`)
      .all()
      .map((c) => [c.name, c.type.toUpperCase()]),
  )

// The categories are seeded by the baseline migration, not imported. Expenses
// reference them by id, so they must be the same rows.
const seeded = db
  .prepare('SELECT id, grouping, name FROM "Category" ORDER BY id')
  .all()
const source = readTable('Category').sort((a, b) => a.id - b.id)
if (JSON.stringify(seeded) !== JSON.stringify(source)) {
  throw new Error('Categories differ between Postgres and the SQLite baseline')
}

for (const table of TABLES) {
  const { n } = db.prepare(`SELECT count(*) n FROM "${table}"`).get()
  if (n > 0) throw new Error(`"${table}" already has ${n} rows; refusing`)
}

db.transaction(() => {
  for (const table of TABLES) {
    const types = columnTypes(table)
    for (const row of readTable(table)) {
      const columns = Object.keys(row)
      const unknown = columns.filter((c) => !(c in types))
      if (unknown.length > 0) {
        throw new Error(`"${table}" has no column ${unknown.join(', ')}`)
      }
      db.prepare(
        `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) ` +
          `VALUES (${columns.map(() => '?').join(', ')})`,
      ).run(...columns.map((c) => convert(row[c], types[c])))
    }
  }
  const broken = db.prepare('PRAGMA foreign_key_check').all()
  if (broken.length > 0) {
    throw new Error(`Foreign key violations: ${JSON.stringify(broken)}`)
  }
})()

let mismatch = false
for (const table of ['Category', ...TABLES]) {
  const expected = readTable(table).length
  const { n } = db.prepare(`SELECT count(*) n FROM "${table}"`).get()
  if (n !== expected) mismatch = true
  console.log(`${table.padEnd(22)} postgres ${expected}  sqlite ${n}`)
}
db.close()
if (mismatch) {
  console.error('Row counts differ')
  process.exit(1)
}
console.log('Import complete.')
