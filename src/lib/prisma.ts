import { PrismaClient } from '@/generated/prisma/client'
import {
  PERF_INSTRUMENTATION_ENABLED,
  recordQuery,
} from '@/lib/perf-instrumentation'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Prisma 7 ships a Rust-free client and requires an explicit driver adapter.
// We use the better-sqlite3 adapter on the file named by DATABASE_URL.
function createPrismaClient() {
  // Checked here as well as in env.ts, because not every path that imports
  // prisma imports env. better-sqlite3 opens an empty path as a temporary
  // database deleted on close, so a missing URL would lose writes silently.
  const url = process.env['DATABASE_URL']?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is not set, e.g. file:./data/spliit.db')
  }
  const adapter = new PrismaBetterSqlite3({ url })
  const client = new PrismaClient({
    adapter,
    // log: [{ emit: 'stdout', level: 'query' }],
  })

  // WAL lets reads proceed while a write is in progress, and makes a crash
  // mid-write cheaper to recover from. The mode is stored in the database file,
  // so this only changes anything on the first start. It cannot run inside a
  // migration, which is a transaction.
  client.$queryRawUnsafe('PRAGMA journal_mode = WAL').catch((error) => {
    console.error('Could not enable SQLite WAL mode', error)
  })

  if (!PERF_INSTRUMENTATION_ENABLED) return client

  // Counts operations into whatever `withPerfCounters` scope is active, so
  // /api/trpc can report how much database work a request did. Only reached
  // when PERF_INSTRUMENTATION=1, i.e. under compose.perf.yaml.
  //
  // `$extends` returns a structurally different (narrower) type than
  // PrismaClient, so the cast is needed to keep one type for both branches.
  // Nothing is removed by the extension -- it only wraps each operation.
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        const start = performance.now()
        try {
          return await query(args)
        } finally {
          recordQuery(performance.now() - start)
        }
      },
    },
  }) as unknown as PrismaClient
}

export let p: PrismaClient = undefined as any as PrismaClient

if (typeof window === 'undefined') {
  if (process.env['NODE_ENV'] === 'production') {
    p = createPrismaClient()
  } else {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    p = globalForPrisma.prisma
  }
}

export const prisma = p
