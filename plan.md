# Split website improvement plan

Research and baseline: **23 November 2026 (Asia/Kolkata)**. Audited revision:
`8b5001db38a57301a3bc9ec8554e2d539e11b20a` (`origin/main`).

Planning PR #1 added the roadmap, contributor instructions, and baseline evidence.
Progress is recorded below; other implementation tasks remain open. The goal is a responsive expense workspace
with trustworthy balances, quick local feedback, useful everyday features, and reliable sync.

## Implementation progress

### Action authorization and validation — 23 November 2026

- [x] **P0-A:** Only a payment participant can record a settlement; the caller and both
      participants must belong to the group. Self-payments and invalid amounts are rejected;
      partial payments, overpayments, and recording money received remain supported.
- [x] **P0-B:** Expense actions validate payer/split memberships, participant uniqueness,
      positive bounded amounts, a maximum of 100 participants, and exact/percentage totals
      using integer hundredths. Recording another member's expense remains supported.
- [x] **P0-F:** Member-joined notifications use a server-only internal helper. Reminders
      require both memberships and a current positive bilateral debt. A transaction and
      group row lock enforce a 24-hour sender/recipient/group cooldown across concurrent requests.
      The drawer displays cooldown and already-paid feedback.
- [x] Add `test`/`typecheck` scripts, local database instructions, and CI using pinned
      Bun 1.3.14, a frozen lockfile, and disposable Postgres 17.

Validation: **63 integration tests passed** against real Postgres, including eight
simultaneous reminder requests producing one notification. Tests substitute session/cache
boundaries and isolate all database operations in a temporary schema; production auth is
unchanged. TypeScript, production build, and frozen-lockfile installation passed.
A production Chromium smoke test used a standard database session in a separate disposable
database: group access, reminder persistence, cooldown feedback, already-paid feedback
with a stale open drawer, and anonymous redirect all passed without uncaught page errors.
Google OAuth itself was not exercised.

**Still open:** P0-C shared allocation/rounding, P0-D/E queue ownership/idempotency,
P1-A atomic ledger/group creation and membership uniqueness, and all responsive work.
The audit below describes the original revision; this section records the fixes since then.

## 1. What exists and how it feels

The app already has Google sign-in, groups, invitations/QR codes, equal/percentage/exact
splits, partial/overpayments, notifications, charts, and an IndexedDB mutation queue.
These are existing features to improve, not new features to build again.

The mobile landing page has a coherent dark palette, indigo accent, and a clear primary
action. Its floating sample cards overlap enough to obscure a balance in the captured
390px view. Muted small text, a large decorative area, and repeated full-screen loaders
deserve review. Authenticated screens use compact cards, bottom navigation, drawers,
and a narrow shell, based on source inspection; their usability was not tested signed in.

Desktop is currently unavailable by design: `src/components/providers/mobile-only.tsx`
replaces all content with an overlay at `md` (768px), including the landing page,
login, and offline fallback. The app shell and bottom navigation also use `max-w-md`.
Removing the overlay alone would leave the rest of the desktop experience unfinished.

Baseline captures: [mobile landing](docs/audit/2026-11-23/mobile-home.png),
[desktop blocker](docs/audit/2026-11-23/desktop-home.png).
Raw browser observations: [report.json](docs/audit/2026-11-23/report.json).

### Verification performed

Installed dependencies were already available. Bun was absent, so checks used Node
24.22.3 with the repository's installed Next.js 16.2.9 and TypeScript binaries.

| Check                                                                       | Result and limits                                                                                                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node node_modules/typescript/bin/tsc --noEmit`                             | Passed.                                                                                                                                                                                         |
| `node node_modules/next/dist/bin/next build`                                | Passed; all 18 static-generation entries completed.                                                                                                                                             |
| `node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3000` | Production server started and served the tested pages.                                                                                                                                          |
| Headless Chromium via Playwright, 900px viewport height                     | `/`, `/login`, `/~offline` returned HTTP 200 at widths 320, 390, 767, 768, 1024, 1440; no uncaught page exceptions or document horizontal overflow observed.                                    |
| Actual visible content                                                      | Mobile content visible below 768px; every tested page showed only “Mobile Only Experience” at 768px and above. HTTP 200 therefore does not establish a usable desktop page.                     |
| Landing primary action                                                      | “Get started free” navigated to `/login`, where the Google button was visible at 390px.                                                                                                         |
| Anonymous route protection                                                  | `/dashboard`, `/groups/test`, `/expenses/new`, `/notifications`, `/profile` redirected to `/login`. This does not verify action authorization.                                                  |
| Reduced-motion emulation                                                    | Three `float` animations continued running on the mobile landing page.                                                                                                                          |
| Viewport / landmarks                                                        | Zoom restrictions present: `maximum-scale=1, user-scalable=no`; two nested visible `main` elements on mobile public pages.                                                                      |
| PWA manifest/icons                                                          | Manifest and each referenced icon returned HTTP 200. This does not establish offline replay or installation quality.                                                                            |
| Calculation reproduction                                                    | Executed the calculation block extracted from `expenses.ts`: ₹0.03 equally split five ways produced `[-0.01, 0.01, 0.01, 0.01, 0.01]`; ₹0.05 split 50/50 produced `[0.03, 0.03]`. No DB writes. |

The shared desktop control tool was unavailable, so repeatable browser checks used the
installed headless runner. Google OAuth client ID/secret were absent. No real sign-in,
group creation, financial write, private-screen interaction, or multi-account/offline
replay was exercised. No Lighthouse/Core Web Vitals score or local-calculation timing
was measured. Findings below distinguish source evidence from browser reproductions.

## 2. Priority fixes before expanding the ledger

P0 means protect ledger integrity and account isolation before broader feature rollout.
These are source-audit findings except the two reproduced rounding examples.

| ID   | Finding and source                                                                                                                                                     | Planned change and acceptance criteria                                                                                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0-A | `src/lib/actions/settlements.ts` checks membership of supplied `fromUserId`, not the authenticated caller or recipient.                                                | Define recording rights: a group member may record a payment involving themselves; any broader owner capability must be explicit. Validate caller and both participants, reject self-payments/nonpositive amounts, and cover outsider/member/participant requests directly in integration tests. |
| P0-B | `src/lib/actions/expenses.ts` does not validate payer/split membership, duplicate participants, exact totals, or percentage totals on the server.                      | Enforce all invariants at the action boundary, with bounded money/participant inputs. Direct calls must reject invalid data even when bypassing the form.                                                                                                                                        |
| P0-C | Equal rounding adjusts only the first row; percentage shares round independently (`expenses.ts`).                                                                      | Introduce shared integer-paise allocation. Sum of shares equals the expense; all shares are nonnegative; preview and persisted rows agree. Cover tiny amounts, uneven groups, percentage ties, and maximum supported values.                                                                     |
| P0-D | `src/lib/offline/db.ts` has no queue owner; `sync.ts` replays all rows with the current session; profile logout does not isolate pending data.                         | Scope queue, snapshots, and private caches to user ID. Pause replay on expired/mismatched sessions. Test A → logout → B, including reload/offline mode; B must never see or submit A's work. Offer a clear policy for preserving pending work without silently deleting it.                      |
| P0-E | Offline mutation IDs never reach actions; the flush lock is tab-local (`src/lib/offline/sync.ts`).                                                                     | Persist an owner-scoped client mutation ID with a unique DB constraint in the same transaction as the ledger write. Identical replay returns the original result; reuse with a different payload is rejected. Lost responses and concurrent tab flushes create one financial record.             |
| P0-F | `src/lib/actions/notifications.ts` exports an unauthenticated internal mutation helper from a `"use server"` module; reminders check login only.                       | Move internal notification creation into a server-only helper. Authorize reminder sender/recipient membership, verify an eligible debt, and enforce a cooldown. Test callable action boundaries; do not rely on UI visibility.                                                                   |
| P1-A | Expense/split and group/owner inserts are separate; member uniqueness is absent (`actions/expenses.ts`, `actions/groups.ts`, `actions/invite.ts`, `db/schema/app.ts`). | Use transactions and a unique `(groupId, userId)` constraint. Audit existing duplicates before migration; fault injection leaves no partial ledger/group, and concurrent invite acceptance yields one membership.                                                                                |
| P1-B | “Balance over time” ignores settlements and calls `allSplits.find` per expense (`src/lib/cache/groups.ts`).                                                            | Define it as outstanding balance, include settlement events and opening balance before the selected range, and index splits once. A fully settled debt reaches zero and chart totals agree with cards.                                                                                           |
| P1-C | Queue insertions do not notify subscribers; online failed rows still show “Syncing” (`offline/queue.ts`, `offline-provider.tsx`).                                      | Show separate waiting/syncing/failed/conflict states, per-item retry and deliberate discard, immediate counts, and refreshed server balances after acknowledgement.                                                                                                                              |
| P1-D | UTC text initializes a `datetime-local` input (`src/components/add-expense-form.tsx`).                                                                                 | Format local input time correctly, serialize instants explicitly, and define display/day-bucketing timezone. Test Asia/Kolkata and a DST-observing zone; an untouched default records the actual current time.                                                                                   |

## 3. Responsive product and visual design

Preserve the existing dark/indigo identity. Make amounts and the next useful action
more prominent than decoration; use consistent tokens for surfaces, borders, spacing,
typography, semantic debt/credit colors, and focus. Labels and signs must convey balance
direction without relying on red/green. Use tabular numerals and consistent `Intl.NumberFormat`.
Keep INR as the first supported currency while introducing a central formatter.

Proposed layout ranges are starting points, to adjust when real content stops fitting,
following [responsive design guidance][responsive]. Use CSS for layout rather than
branching initial markup on `window.innerWidth`.

| Viewport   | Proposed experience                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 320–639px  | Single column, safe-area-aware bottom navigation, full-width cards, bottom sheets with scrollable form content. Primary actions remain visible above the keyboard.                         |
| 640–1023px | Compact navigation rail where space permits; two-column group cards; readable, bounded form width. Sheets may become centered dialogs without resetting drafts.                            |
| 1024px+    | Approximately 240px sidebar plus fluid workspace capped around 1440px. Dashboard summary row and group grid; group page has activity and a balance panel; analytics uses a grid of charts. |

Desktop group-page sketch:

```text
┌─────────────┬─────────────────────────────────────────────┐
│ Split       │ Group title / tabs            Add expense   │
│ Groups      ├───────────────────────────────┬─────────────┤
│ Activity*   │ Search / filters              │ Balances    │
│ Alerts      │ Expense / settlement history  │ Settle up   │
│ Profile     │ Load more                     │ Members     │
└─────────────┴───────────────────────────────┴─────────────┘
*Cross-group activity is a later feature, not an existing route.
```

- [ ] Replace `MobileOnly`; rebuild `(app)/layout.tsx`, `bottom-nav.tsx`, public pages,
      group tabs, fixed action positions, offline banners, and loading/error states together.
- [ ] Use one primary `main`, a skip link, labeled navigation, and `aria-current`.
      Give add/copy icon buttons accessible names; associate form labels with inputs.
- [ ] Use the existing Dialog/Drawer primitives for a shared responsive form container;
      preserve focus, draft values, Escape/Back behavior, and return focus to the trigger.
- [ ] Add a desktop landing composition with text beside a legible app preview and a
      feature grid. Avoid overlapping monetary values in the phone preview.
- [ ] Enable zoom; verify 320 CSS-pixel reflow and 200%/400% zoom. Use 44px touch targets
      as the project goal, and meet WCAG's 24px minimum/spacing rules where applicable.
      See [reflow][reflow] and [target size][targets].
- [ ] Validate long names, large amounts, 0/1/50 groups, empty charts, offline banners,
      virtual keyboard, keyboard-only forms, and focused controls near sticky navigation.
- [ ] Check contrast, non-color chart labels, and a data-table alternative for charts.
      Automated accessibility checks supplement manual keyboard/screen-reader checks.

## 4. Animation that supports speed

Use existing CSS/Tailwind animation support first. Start with 120–180ms button/status
feedback and 180–240ms dialog/panel transitions; these are proposed design tokens to
validate on devices. Prefer `transform` and `opacity` over animated `width`/`left`
(the current `slide-bar` loader animates layout properties). Follow [animation guidance][animation].

- [ ] Add an explicit reduced-motion path for hero cards, loaders, drawers, and Recharts;
      use static feedback without changing the meaning of loading/success/error states.
      Stop decorative autoplay after a brief introduction or provide a pause control.
- [ ] Replace repeated full-screen loaders with stable route skeletons and local pending
      buttons. Keep labels readable and announce save/sync/error status politely.
- [ ] Keep totals legible during updates; never delay expense input or server submission
      to finish an animation. Avoid progress meters that imply measured progress without data.
- [ ] Record performance traces under CPU throttling and inspect layout/paint work and
      dropped frames. Emulate reduced motion in browser regressions ([reference][motion]).
- [ ] Consider Motion only if a later interaction needs interruptible orchestration that
      CSS and existing primitives cannot provide; require a measured bundle/UX justification.

### Design skills and references researched

[Vercel's Web Interface Guidelines][guidelines] and the official
[web-design-guidelines agent skill][design-skill] provide a practical review checklist
for focus, forms, motion, semantics, and responsive layouts. Its skill metadata and
bundled reference were inspected as research; no third-party skill was installed.
[React Best Practices][react-practices] is useful for reviewing waterfalls, bundle size,
and unnecessary client work in this Next.js stack. Adopt relevant rules selectively
and pin/review any future imported skill; the local `AGENTS.md` remains the project guide.

## 5. Fast local calculations and reliable offline work

Local previews should respond immediately while server authorization and durable writes
remain authoritative. The existing queue is a starting point; it is not yet a complete
local data model.

1. **Shared math first.** Add pure `parseMoney`, `allocateEqual`, `allocatePercentage`,
   `validateExact`, and `reduceLedger` functions in a client-safe module. Parse decimal
   strings directly into paise, not through binary floats. Use quotient/remainder or
   largest-remainder allocation with a stable participant-ID tie-break. Percentage
   weights use integer basis points totaling 10,000. Bound intermediate multiplication
   and aggregate totals to safe integers ([numeric limits][integers]); use BigInt internally
   if the supported bounds require it. Keep Postgres numeric serialization explicit.
2. **Match the form to stored results.** Show each person's actual allocated share,
   including remainder differences. Exact inputs show the unallocated amount immediately.
   Cache a draft locally per user/group and restore it after navigation/reload.
3. **Make the ledger atomic and replayable.** Implement P0-A–F and P1-A before optimistic
   writes. Add backwards-compatible queue-version handling and an upgrade path for old
   unowned entries that never attributes them automatically to the next signed-in user.
4. **Add scoped snapshots.** Store only authorized group/member/ledger data in IndexedDB;
   reconcile server revisions and pending mutations without applying either twice. Mark
   projected balances as pending, distinguish offline from server rejection, and show
   last-sync time. Membership removal must block replay and clear inaccessible snapshots.
5. **Remove avoidable work.** Replace nested split searches with maps; paginate database
   history queries with stable `(date, id)` cursors. Bound prefetch work in `cache-warmer.tsx`
   and narrow broad `"groups"` invalidation to affected users/groups. Load charts only
   where needed. Profile before adding manual memoization to React Compiler output.
6. **Benchmark, then choose workers.** Fixtures: 2/10/50 members and 100/1,000/10,000 ledger
   events. Record cold/warm p50/p95, hardware, browser, CPU throttle, payload size, and
   calculation/render timing separately. Proposed budget: p95 preview math under 10ms
   for 50 members and no calculation-induced task above 50ms. If large ledger reductions
   exceed budget, move those to a Web Worker with request IDs/cancellation; keep ordinary
   form splitting simple. Workers have messaging costs and cannot update the DOM
   ([worker guidance][workers]). These budgets are goals, not baseline measurements.

For page performance, target field p75 LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1; report lab
results separately from real-user results ([Core Web Vitals][vitals]). Establish bundle
and request-count baselines before setting regression budgets.

## 6. Feature backlog

Effort is relative: S = one focused change, M = several connected changes,
L = schema/sync/UI work across multiple PRs. Sequence features after the integrity work;
the first responsive shell can proceed alongside isolated correctness fixes.

| Priority | Feature / user value                                                       | Dependencies                                                           | Effort | Done when                                                                                                                                                |
| -------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | Search/filter/sort expenses and activity by person, category, date, amount | Paginated history API                                                  | M      | URL preserves filters; reset, Back, empty results, and scoped offline search work.                                                                       |
| P1       | Editable/deletable expenses with audit history and undo                    | Shared math, authorization, transactions, revision/conflict handling   | L      | Permission checks and revisions preserve an inspectable history; conflicting offline edits require resolution.                                           |
| P1       | Drafts, recent categories, duplicate expense                               | Scoped local storage and correct allocation                            | M      | Reload restores drafts; duplicate creates an editable new draft, never a financial write by itself.                                                      |
| P1       | Sync center and clear recoverable errors                                   | Owned/idempotent queue                                                 | M      | Waiting/failed/conflict records have useful actions; successful replay updates balances once.                                                            |
| P1       | CSV export for a group and selected period                                 | Stable ledger/currency/date semantics                                  | M      | Export matches visible totals, respects membership, and neutralizes spreadsheet formula injection.                                                       |
| P2       | Group settings, archive, invite rotation, member roles                     | Authorization policy and membership constraints                        | M      | Old invites stop working; archived data stays readable; leaving cannot silently erase outstanding balances.                                              |
| P2       | Suggested simpler settlements                                              | Shared ledger reducer                                                  | M      | Suggested transfers preserve each member's net balance; no payment is written without explicit confirmation. Do not promise a globally minimal solution. |
| P2       | Recurring expense templates and reminders                                  | Idempotency, revisions, timezones, abuse limits                        | L      | Start with “due” drafts users confirm; recurrence does not duplicate around reconnect/DST.                                                               |
| P2       | Cross-group activity and richer analytics                                  | Paginated ledger queries and P1-B                                      | M      | Group totals reconcile; paid/owed/settled are clearly distinguished; charts have readable alternatives.                                                  |
| P2       | Theme preference and onboarding/demo                                       | Accessible tokens and responsive shell                                 | M      | System/light/dark persist without flashing; an isolated sample dataset works without production-auth bypasses.                                           |
| P3       | Multiple payers, weighted/itemized splits                                  | Math policy and new schemas/tests                                      | L      | Payer totals and allocated shares both equal the bill; local/server results match.                                                                       |
| P3       | Receipts and optional OCR                                                  | Authorized object storage, limits, privacy/deletion policy             | L      | Attachments are access-controlled; OCR is an editable suggestion and never silently changes an amount.                                                   |
| P3       | Multi-currency groups                                                      | Currency schema, exponents, rate provenance, rounding/migration policy | L      | No mixed-currency sum without explicit conversion; historical rates and originals remain inspectable.                                                    |

## 7. Suggested PR sequence and validation gates

1. **This PR — plan and contributor guide.** Preserve the baseline screenshots/report,
   research links, test limitations, and Git identity requirements. No runtime changes.
2. **Action authorization and validation.** P0-A/B/F; add a test runner and isolated
   integration fixtures with outsider, participant, and invalid-request cases.
3. **Shared allocation and atomic writes.** P0-C/P1-A; add property tests for conservation,
   nonnegative shares, deterministic allocation, and safe bounds. Audit existing financial
   inconsistencies and propose a repair report before changing historical records.
4. **Queue ownership and idempotency.** P0-D/E and P1-C; versioned migrations, account-switch
   tests, duplicate/lost-response/concurrent-tab replay, partial failure, and expired auth.
5. **Responsive shell and accessibility.** Implement section 3, including public pages;
   browser checks at 320/390/640/767/768/1024/1440px and immediately around chosen breakpoints.
6. **Performance, analytics, and motion.** P1-B/D and sections 4–5; attach before/after traces,
   fixture sizes, and bundle results. Confirm settlement/chart reconciliation.
7. **Daily-use features.** Ship search, drafts, editing/history, and export as separate
   reviewable increments; then reassess the P2/P3 backlog with actual usage feedback.

For runtime PRs, require type check, production build, relevant unit/integration checks,
and a production browser smoke test. Add CI with a pinned Bun version and frozen lockfile;
keep test credentials out of logs and use a disposable database. Add Playwright regression
coverage once fixtures can sign in safely in tests, and automated accessibility scans
alongside manual keyboard, zoom, and screen-reader checks.

Offline acceptance matrix must include initial online visit → offline reload, cached versus
unvisited routes, create while offline → reconnect, refresh during replay, commit succeeded
but response lost, two tabs, expired session, logout/account switch, removed group membership,
storage failure, and service-worker upgrade with pending mutations. Include real iOS Safari
and Android Chrome PWA checks; a desktop Chromium emulation alone cannot establish those.

No item is complete until its evidence and limitations are recorded. Signed-in end-to-end
validation requires a dedicated database and Google OAuth test configuration; use isolated
fixtures and test-only session setup where appropriate, never a production auth bypass.

## Sources

Primary documentation and official design/skill resources accessed 23 November 2026.
Recommendations and budgets above are project proposals, not claims that these sources
have measured this app.

[responsive]: https://web.dev/articles/responsive-web-design-basics
[reflow]: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
[targets]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[animation]: https://web.dev/articles/animations-guide
[motion]: https://web.dev/articles/prefers-reduced-motion
[guidelines]: https://vercel.com/design/guidelines
[design-skill]: https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
[react-practices]: https://vercel.com/blog/introducing-react-best-practices
[integers]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER
[workers]: https://web.dev/articles/off-main-thread
[vitals]: https://web.dev/articles/vitals
