# Split

A mobile-only progressive web app for splitting expenses with friends. Built with Next.js 16, Drizzle ORM, and Supabase Postgres.

![Split App](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss) ![PWA](https://img.shields.io/badge/PWA-offline--ready-6366f1?style=flat-square)

## Features

**Core**

- Create groups with a name, description, and accent color
- Invite members via a shareable link or QR code
- Add expenses with equal, percentage, or exact splits
- Settle up with any group member, with support for partial and overpayments
- Real-time balance calculations showing exactly who owes whom

**Analytics**

- Spending breakdown by category (donut chart)
- Member contribution comparisons (bar chart)
- Net balance over time (line chart)
- Period filters: week, month, 6 months, year, all time

**Notifications**

- Get notified when a member joins your group
- Send payment reminders to members who owe you
- Unread badge on the notifications tab

**Progressive Web App**

- Install on any device from the browser
- Offline support: add expenses and settle up without internet
- Mutations are queued in IndexedDB and synced automatically on reconnect
- Pages cache on navigation for instant offline reads
- Custom offline fallback page

## Tech Stack

| Layer           | Technology                         |
| --------------- | ---------------------------------- |
| Framework       | Next.js 16 (App Router, Turbopack) |
| Language        | TypeScript 5                       |
| Styling         | Tailwind CSS v4 + shadcn/ui        |
| Database        | Supabase Postgres                  |
| ORM             | Drizzle ORM                        |
| Auth            | NextAuth v5 (Google OAuth)         |
| Charts          | Recharts via shadcn/ui chart       |
| PWA             | Serwist (@serwist/turbopack)       |
| Offline Storage | IndexedDB via idb                  |
| Runtime         | Bun                                |
| Deployment      | Vercel                             |

## Architecture Highlights

**Performance**

- N+1 queries eliminated via batched SQL with `inArray` + `Promise.all`
- Server component caching with Next.js 16 `"use cache"` directive and `cacheTag`
- Cache invalidation via `updateTag` on every mutation
- Query results aggregated in memory instead of per-row round trips

**Offline-first mutations**

- `add expense` and `settle up` work fully offline
- Mutations serialized to IndexedDB with status tracking (pending, syncing, failed)
- Auto-flush queue on reconnect and on visibility change
- Double-tap protection via `useRef` guard to prevent duplicate queue entries

**Auth**

- Google OAuth via NextAuth v5 with Drizzle adapter
- Session stored in Postgres, validated per request
- Protected routes via Next.js proxy (middleware)

## Getting Started

**Prerequisites**

- Bun 1.x
- A Supabase project (for Postgres)
- Google OAuth credentials

**Setup**

Clone the repository:

```bash
git clone https://github.com/EvolutionX-10/split.git
cd split
bun install
```

Create a `.env` file:

```env
DATABASE_URL=your_supabase_session_pooler_url
AUTH_SECRET=your_nextauth_secret
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTH_URL=http://localhost:3000
```

Push the database schema:

```bash
bunx drizzle-kit push
```

Start the development server:

```bash
bun dev
```

> Note: The PWA service worker is disabled in development. Run `bun build && bun start` to test offline features.

## Validation

```bash
bun run typecheck
bun run build
```

The action regression suite uses Bun's test runner and **real Postgres**. Session and
Next.js cache boundaries are substituted in the tests; production authentication stays
unchanged. Tests call the expense, settlement, invitation, and notification actions
directly to cover unauthorized callers, invalid splits, payment recording rights,
reminder debt eligibility, and concurrent cooldown enforcement.

Start a disposable local database (the password below is only for this test container):

```bash
docker run --rm --detach --name split-action-tests \
  --publish 127.0.0.1:55432:5432 \
  --env POSTGRES_PASSWORD=split-test-only \
  --env POSTGRES_DB=split_actions_test postgres:17-alpine
docker exec split-action-tests pg_isready -U postgres -d split_actions_test
```

Once Postgres is ready:

```bash
TEST_DATABASE_URL=postgres://postgres:split-test-only@127.0.0.1:55432/split_actions_test bun run test
docker stop split-action-tests
```

The suite requires a local host and a database name ending in `_test`. It creates a
random schema, applies the migrations there, and drops that schema afterward. The test
database user needs permission to create schemas. It never falls back to the app's
`DATABASE_URL`; do not supply a shared or production database. CI runs this suite,
type checking, and the production build with Bun 1.3.14 and Postgres 17.

Server actions now require every payer/split/payment participant to belong to the
group. Any member can log an expense on behalf of another member; only a payment's
sender or recipient can record it. Amounts must be positive and fit `numeric(10, 2)`;
expenses support up to 100 distinct split participants, and exact/percentage inputs
must total the expense/100%. Reminders require a positive current debt between the
sender and recipient and allow one reminder per sender/recipient/group per 24 hours.

Equal and percentage splits now allocate whole paise with the largest-remainder method;
ties use stable participant ID order. The form shows each person's actual saved share,
including zero shares for tiny bills, and exact/percentage inputs show the remaining
amount to allocate. The preview and server use the same pure calculation module.
Expenses with their splits, groups with their owner, and invite memberships with their
join notifications commit together or roll back together. Concurrent joins are serialized.

Run `bun test tests/splits.test.ts` for calculation checks without a database, or
`bun run benchmark:splits` for a local calculation-only p50/p95 report (2–100 people).
The full suite includes seeded property checks, forced-write failures, concurrent joins,
and migration tests in disposable schemas.

### Ledger preflight and membership migration

Before applying the new membership constraint to an existing database, run the read-only
report in [`scripts/audit-ledger.sql`](scripts/audit-ledger.sql). With a PostgreSQL client,
set `AUDIT_DATABASE_URL` explicitly to the intended database and run:

```bash
psql "$AUDIT_DATABASE_URL" --set ON_ERROR_STOP=1 --file scripts/audit-ledger.sql
```

The report lists duplicate memberships (including IDs and roles), missing/duplicate/negative
shares, totals that do not reconcile, and participants outside their recorded group.
Historical membership changes can also explain some membership findings; inspect the
records before deciding on repairs. It runs in a read-only transaction with a statement
timeout and never changes history. Treat report output as private financial data.

Resolve duplicate memberships explicitly, retaining the intended role and join history;
then apply [`drizzle/0001_unique_group_members.sql`](drizzle/0001_unique_group_members.sql)
through your database migration process. The constraint refuses duplicates without
deleting any rows. For installations created with `db:push` and no migration history,
apply the reviewed incremental SQL through your database administration tooling;
do not replay `0000_mighty_skrulls.sql` against an existing database. New installations
can use the current schema as described in setup. No automatic repair or production
migration runs as part of the build. The new join transaction also works before the
constraint is installed, so rollout does not depend on an `ON CONFLICT` target existing.

## Database Schema

```
users           auth accounts, sessions (NextAuth)
groups          name, accent color, invite token
group_members   userId + groupId + role (owner/member)
expenses        amount, category, split type, paid by
expense_splits  per-member owed amount for each expense
settlements     explicit pay-back transactions between members
notifications   member joined, reminders, settlements
```

## Project Structure

```
src/
  auth.ts                   NextAuth config + Google provider
  proxy.ts                  Route protection (Next.js middleware)
  sw.ts                     Serwist service worker
  app/
    (auth)/login            Google sign in page
    (app)/
      dashboard             Groups list with balance summaries
      groups/[id]           Group home, members, transactions, analytics
      expenses/new          Add expense form
      notifications         Notification feed
      profile               User profile + sign out
    invite/[token]          Public invite acceptance page
  components/               UI components (cards, drawers, charts, nav)
  db/
    schema/auth.ts          NextAuth tables
    schema/app.ts           App tables + relations
    validators.ts           Zod schemas via drizzle-zod
  lib/
    actions/                Server actions (groups, expenses, settlements, notifications)
    cache/                  "use cache" data fetching functions
    offline/                IndexedDB queue, sync engine, utils
    ledger/                 Shared money parsing and deterministic split allocation
    server/                 Internal server-only helpers
    validation/             Request validation shared with ledger calculations
    constants.ts            Category icons, labels
```

## License

MIT
