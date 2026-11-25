import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Prisma 7 no longer reads `.env` automatically. Load it when available so the
// Prisma CLI (generate, migrate) picks up local credentials. In production
// (Docker / Next.js) the variables are already present in the environment, and
// a missing `.env` file or `dotenv` package is harmless.
try {
  require('dotenv').config()
} catch {}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    // The SQLite file, e.g. `file:./data/spliit.db`. A relative path resolves
    // against the working directory, the same as for the app.
    url: process.env.DATABASE_URL ?? '',
  },
})
