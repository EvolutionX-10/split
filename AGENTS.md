# Contributor and agent instructions

## Git identity

Use this identity for **every commit**, including merge and follow-up commits:

```text
name: EvolutionX-10
email: 85353424+EvolutionX-10@users.noreply.github.com
```

Before committing, set repository-local configuration:

```sh
git config user.name EvolutionX-10
git config user.email 85353424+EvolutionX-10@users.noreply.github.com
```

Verify both author and committer with `git show --no-patch --format=fuller HEAD`.
Do not change global Git configuration or rewrite existing history to apply this rule.

## Project and scope

Split is an expense-sharing PWA using Next.js 16 App Router, React 19, TypeScript,
Tailwind CSS v4, shadcn/Radix/Vaul, NextAuth v5, Drizzle, Postgres, IndexedDB, and Serwist.
Read `README.md`, `package.json`, and the relevant sections of `plan.md` before changes.
The roadmap describes future work; it does not authorize implementing every item at once.
Keep each PR focused and update completed roadmap items with actual validation evidence.

## Setup and commands

- Bun is the intended package manager; preserve `bun.lock` and use `bun install --frozen-lockfile`.
- Development: `bun run dev`; production checks: `bun run build`, then `bun run start`.
- Type checking: `bun run typecheck`; format changed files with `bunx prettier --check --end-of-line auto <files>`.
- Action regression tests: `bun run test`, with a dedicated local `TEST_DATABASE_URL`
  ending in `_test`; see `README.md`. The suite uses real Postgres in an isolated schema,
  substitutes framework/session boundaries, and never falls back to `DATABASE_URL`.
- CI uses Bun 1.3.14 and Postgres 17. There is no `lint` script; inspect available scripts
  rather than claiming commands exist. Preserve existing line endings in edited files.
- If Bun is unavailable and dependencies are installed, `node node_modules/typescript/bin/tsc --noEmit`
  and `node node_modules/next/dist/bin/next build` are fallback checks. Report the runtime used.
- PWA behavior must be checked against a production build; development disables the service worker.
- Use a dedicated local/test database for mutation tests. `db:push` changes schema;
  do not run it against an unknown/shared database as a setup shortcut.
- Never commit `.env*`, credentials, OAuth sessions, database dumps, `.next`, or dependencies.
  Use the environment variable names documented in `README.md`; do not print their values.

## Code ownership and conventions

- Routes and server layouts: `src/app`; reusable UI: `src/components`.
- Authentication: `src/auth.ts` and `src/proxy.ts`; server mutations: `src/lib/actions`.
- Cached queries: `src/lib/cache`; durable offline queue/replay: `src/lib/offline`.
- Schema: `src/db/schema`; generated migrations: `drizzle`; service worker: `src/sw.ts`.
- Use `@/` imports, strict TypeScript, and existing components/tokens before adding dependencies.
  Follow `.prettierrc`; avoid reformatting unrelated generated UI files.
- Keep database/auth code server-side. Exported actions in a `"use server"` module are
  request boundaries: validate and authorize each action independently. Put internal
  mutation helpers in a server-only module rather than exposing them as actions.
- Review cache keys, user scope, and invalidation whenever data access or mutations change.
  Never use another user's private data to satisfy a local cache or offline queue.

## Financial and offline correctness

- For new calculation work, use a shared pure calculation module with integer minor
  units and explicit input bounds. Preserve exact totals with deterministic remainder
  allocation; use the same logic for local previews and authoritative server calculation.
- Validate positive expense/payment amounts, unique participants, group membership,
  payer identity, percentage totals, and exact-split totals on the server.
- Related ledger writes must be atomic. Offline replay needs a durable idempotency key
  enforced by a database uniqueness constraint; a disabled button is insufficient.
- Scope queued work and cached private records to the authenticated user. Define
  logout, expired-session, retry, and account-switch behavior before changing replay.
- Do not silently discard unsynced records, change historical balances, or mark a local
  preview as successfully synced before server acknowledgement.
- Expense/payment inputs require `ownerId` and `mutationId`. Persist them before any
  request, reuse them unchanged on retry, and never automatically adopt legacy unowned
  queue entries. Ledger writes and `mutation_receipts` must commit atomically.
- The worker caches public assets only. Do not restore URL-keyed private HTML/RSC/API
  caching; account-scoped snapshots require a separate ownership and invalidation design.
- IndexedDB-only checks: `bun test tests/offline.test.ts`. Apply the receipt migration
  before runtime deployment; never delete receipts as a cache cleanup shortcut.

## UI and accessibility

- Preserve mobile use while implementing the responsive roadmap; remove the existing
  desktop gate as part of a complete layout change, including public and fallback pages.
- Test narrow phones, tablets, desktop, keyboard navigation, zoom, long content, empty
  states, pending/error states, and reduced motion for affected flows.
- Use semantic landmarks, associated form labels, names for icon buttons, visible focus,
  and announced async status. Keep zoom enabled in future viewport changes.
- Prefer short `transform`/`opacity` feedback. Respect `prefers-reduced-motion`, avoid
  indefinite decorative loops, and keep inputs responsive during calculations.
- Measure before adding animation libraries, workers, virtualization, or manual memoization.

## Validation and PRs

- Run checks appropriate to the change. For runtime changes, run type checking and a
  production build, plus targeted regression coverage for affected behavior.
- Financial/auth/replay changes require meaningful unit or integration tests, including
  direct invalid requests, rounding boundaries, rollback, and duplicate replay as relevant.
- UI changes require browser checks at representative widths and around changed breakpoints.
  Offline changes require a production service worker and reconnect/reload checks.
- Documentation-only changes need formatting, link/path review, and `git diff --check`;
  do not add artificial tests just to exercise prose.
- Report exactly what passed, failed, or could not run. Missing OAuth/database access
  means signed-in flows are unverified; never bypass production authentication to claim success.
- PR descriptions should explain the problem, resulting behavior, validation, and remaining
  limitations. Do not deploy or merge merely because a PR was requested.
