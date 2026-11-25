/**
 * Seeds the performance database with a deterministic dataset.
 *
 * Writes the SQLite file directly through `better-sqlite3` rather than through
 * Prisma, for two reasons. The generated Prisma 7 client is ESM-only and cannot
 * be required from the CommonJS context tsx gives these scripts; and prepared
 * INSERTs inside one transaction are far faster than `createMany` for the tens
 * of thousands of rows this writes. Going through `src/lib/api.ts` would be
 * slower still -- that path writes one expense per call and logs an activity
 * for each.
 *
 * Values are written in the form the Prisma adapter itself writes, or the app
 * would read them back differently: DateTime as ISO-8601 text with a `+00:00`
 * offset, booleans as 0/1, enums as their names.
 *
 * Runs before the app starts (see scripts/perf.sh), never against a live app:
 * the container creates SQLite's -wal/-shm files as root, which a host process
 * on Linux could not open.
 *
 * Three properties of this data are load-bearing for the budgets:
 *
 * 1. **Fixed seed, fixed timestamps.** `budgets.ts` asserts on response byte
 *    sizes, which are only stable if the rows are identical every run.
 *
 * 2. **Total ordering is unambiguous.** The expense list sorts by
 *    `[{expenseDate: desc}, {createdAt: desc}]`. If two rows tied on both,
 *    SQLite could return them in either order and the byte counts would flap.
 *    Every expense therefore gets a unique `createdAt`.
 *
 * 3. **Nothing recurs.** `getGroupExpenses` calls `createRecurringExpenses()`
 *    on every read (src/lib/api.ts), which *writes* when a frame is due -- during
 *    a benchmark that would move both row and query counts between iterations.
 *    Every expense is `NONE` with no `RecurringExpenseLink`, so that pass finds
 *    nothing to do and stays a single constant-cost query.
 */
import Database from 'better-sqlite3'
import {
  config,
  expenseCountFor,
  expenseId,
  groupId,
  paidForCountFor,
  participantCountFor,
  participantId,
  SEARCH_TOKEN,
  seedDatabasePath,
} from './config'
import { makeRandom } from './random'

const TITLES = [
  'Groceries',
  'Dinner',
  'Taxi',
  'Train tickets',
  'Hotel',
  'Museum',
  'Coffee',
  'Brunch',
  'Petrol',
  'Parking',
  'Snacks',
  'Drinks',
  'Cinema',
  'Supermarket',
  'Pharmacy',
  'Bakery',
  'Lunch',
  'Ferry',
]

const NAMES = [
  'Ada',
  'Bruno',
  'Chiara',
  'Dmitri',
  'Elena',
  'Farid',
  'Greta',
  'Hugo',
  'Ines',
  'Jonas',
  'Kira',
  'Lars',
  'Mira',
  'Noor',
  'Otto',
  'Pia',
  'Quentin',
  'Rosa',
  'Sven',
  'Tuva',
]

/**
 * Fixed epoch for every generated timestamp. `new Date()` would change the
 * payload on each run and defeat the byte budgets.
 */
const EPOCH = Date.UTC(2025, 0, 1, 12, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1000

const pad = (value: number, width: number) => String(value).padStart(width, '0')

/** A DateTime as the Prisma SQLite adapter stores it. */
function toTimestamp(ms: number): string {
  return new Date(ms).toISOString().replace('Z', '+00:00')
}

/** `expenseDate` is a calendar day carried as UTC midnight. */
function toDateOnly(ms: number): string {
  const d = new Date(ms)
  return toTimestamp(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
}

/** Inserts `rows` into `table` with one prepared statement. */
function insertRows(
  db: Database.Database,
  table: string,
  columns: string[],
  rows: unknown[][],
) {
  const statement = db.prepare(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) ` +
      `VALUES (${columns.map(() => '?').join(', ')})`,
  )
  for (const row of rows) statement.run(...row)
}

function main() {
  const db = new Database(seedDatabasePath, { fileMustExist: true })
  db.pragma('foreign_keys = ON')

  try {
    const categories = db
      .prepare('SELECT id FROM "Category" ORDER BY id ASC')
      .all() as { id: number }[]
    if (categories.length === 0) {
      throw new Error(
        'No categories found. The database is missing its migrations -- run `prisma migrate deploy` first.',
      )
    }

    let totalExpenses = 0

    db.transaction(() => {
      // Never Category (seeded by the baseline migration -- expenses reference
      // it) or _prisma_migrations. Children first, for the foreign keys.
      for (const table of [
        'ExpensePaidFor',
        'ExpenseDocument',
        'RecurringExpenseLink',
        'Activity',
        'Expense',
        'Participant',
        'Group',
      ]) {
        db.prepare(`DELETE FROM "${table}"`).run()
      }

      for (let g = 1; g <= config.groups; g++) {
        // Seeded per group, so raising PERF_GROUPS does not reshuffle the data
        // of the groups that were already there.
        const random = makeRandom(0x5eed + g)
        const participants = participantCountFor(g)
        const expenses = expenseCountFor(g)

        insertRows(
          db,
          'Group',
          ['id', 'name', 'currency', 'currencyCode', 'createdAt'],
          [
            [
              groupId(g),
              `Perf Group ${pad(g, 2)}`,
              '$',
              'USD',
              toTimestamp(EPOCH),
            ],
          ],
        )

        insertRows(
          db,
          'Participant',
          ['id', 'name', 'groupId'],
          Array.from({ length: participants }, (_, p) => [
            participantId(g, p),
            `${NAMES[p % NAMES.length]} ${p}`,
            groupId(g),
          ]),
        )

        const expenseRows = Array.from({ length: expenses }, (_, i) => {
          // Every 10th expense carries SEARCH_TOKEN, so the search step matches
          // an exactly known number of rows (config.searchMatchCount).
          const title =
            i % 10 === 0
              ? `${SEARCH_TOKEN} ${random.pick(TITLES)}`
              : `${random.pick(TITLES)} ${i}`

          return {
            id: expenseId(g, i),
            title,
            amount: random.int(250, 25000),
            // Three expenses per day, and a strictly decreasing createdAt, so
            // (expenseDate desc, createdAt desc) is a total order equal to `i`.
            expenseDate: toDateOnly(EPOCH - Math.floor(i / 3) * DAY_MS),
            createdAt: toTimestamp(EPOCH - i * 1000),
            categoryId: categories[i % categories.length]!.id,
            paidById: participantId(g, i % participants),
            // A minority of reimbursements, as in a real group.
            isReimbursement: i % 17 === 0,
            splitMode: i % 7 === 0 ? 'BY_SHARES' : 'EVENLY',
          }
        })

        insertRows(
          db,
          'Expense',
          [
            'id',
            'title',
            'amount',
            'expenseDate',
            'createdAt',
            'categoryId',
            'paidById',
            'groupId',
            'isReimbursement',
            'splitMode',
            'recurrenceRule',
          ],
          expenseRows.map((e) => [
            e.id,
            e.title,
            e.amount,
            e.expenseDate,
            e.createdAt,
            e.categoryId,
            e.paidById,
            groupId(g),
            e.isReimbursement ? 1 : 0,
            e.splitMode,
            'NONE',
          ]),
        )

        insertRows(
          db,
          'ExpensePaidFor',
          ['expenseId', 'participantId', 'shares'],
          expenseRows.flatMap((expense, i) =>
            Array.from({ length: paidForCountFor(g, i) }, (_, s) => [
              expense.id,
              participantId(g, (i + s) % participants),
              expense.splitMode === 'BY_SHARES' ? 1 + (s % 3) : 1,
            ]),
          ),
        )

        totalExpenses += expenses
      }
    })()

    console.log(
      `Seeded ${config.groups} groups / ${totalExpenses} expenses ` +
        `(large group ${groupId(1)}: ${config.largeGroupExpenses} expenses, ` +
        `${config.largeGroupParticipants} participants).`,
    )
  } finally {
    db.close()
  }
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
