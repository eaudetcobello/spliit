# Local development

This fork is checked out at `C:\Users\etien\Developer\spliit`.
Origin: https://github.com/eaudetcobello/spliit
Upstream: https://github.com/spliit-app/spliit

## Start

Start Docker Desktop, open a terminal in this directory, then run:

```powershell
npm run dev:local
```

Open http://localhost:3000. Changes in `src` reload automatically.
Stop the web server with Ctrl+C. The database keeps its data in a Docker named volume.
`npm run db:down` stops the database without deleting that volume.

## Useful commands

- `npm run db:up`: start PostgreSQL and wait for readiness.
- `npm run db:deploy`: apply existing migrations and generate Prisma Client.
- `npm run db:migrate -- --name your_change`: create and apply a local schema migration.
- `npm run db:studio`: inspect the local database in Prisma Studio.
- `npm run check-types`: type-check the application.
- `npm run lint`: run the linter.
- `npm test -- --runInBand`: run unit tests.

The development database is separate from the hosted Spliit database. It starts empty;
create a local group to try expense splitting. Your imported financial history remains on the server.
Connection settings are in the Git-ignored `.env`; do not commit that file.

Node 24+ and npm 11+ are required. The installed Node and npm versions satisfy these requirements.
After pulling changes, run `npm ci` with the database running, then `npm run dev:local`.

## Git workflow

```powershell
git switch -c feature/my-change
git add <changed-files>
git commit -m "Describe the change"
git push -u origin HEAD
```

To update your fork, use `gh repo sync eaudetcobello/spliit --source spliit-app/spliit`,
then `git pull --ff-only origin main` on a clean main branch.
The original MIT license is retained in `LICENSE`.
