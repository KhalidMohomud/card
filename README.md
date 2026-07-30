# SwiftWash POS

Production-oriented, single-store car wash point-of-sale and operations system built with Next.js 16, TypeScript, PostgreSQL, Prisma, Zod, and Tailwind CSS.

## Included modules

- Username/password authentication with five-minute database sessions, login throttling, account disable support, and ADMIN/SUPERVISOR authorization.
- Role-specific dashboards calculated from live receipt, expense, purchase, and inventory records.
- Touch-friendly POS with database-priced services, server-side totals, and idempotent receipt creation.
- Immutable receipt snapshots, cancellation instead of deletion, authorised reprints, and a dedicated browser-printable 58mm receipt route.
- Service, payment-method, supervisor, expense, supplier, inventory, purchase, settings, and audit-log administration.
- Worker commissions calculated as `car count × rate` on the server, with receipt-count warnings and explicit admin override reasons.
- Decimal stock movement ledger, serializable purchase receiving and inventory issuing, consumable returns, and reusable assignment/damage/loss handling.
- Date-filtered sales, expense, purchase, cash-summary, stock, issue, damage/loss, and movement reporting, including CSV exports.

## Requirements

- Node.js 20 or newer
- PostgreSQL 15+ or Prisma Postgres
- npm 10+ (pnpm is also supported)

## Environment

Copy `.env.example` to `.env` and set:

- `DATABASE_URL`: pooled PostgreSQL connection used by application traffic.
- `DIRECT_URL`: direct PostgreSQL connection used by migrations. It may equal `DATABASE_URL` for a local non-pooled database.
- `ADMIN_NAME` and `ADMIN_USERNAME`: identify the first administrator created by the idempotent seed.
- `ADMIN_PASSWORD_HASH`: a salted scrypt hash used only when the administrator credential is first created. Generate it with `npm run auth:hash-password`.

Never prefix database or auth secrets with `NEXT_PUBLIC_`.

## Local setup

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open `http://localhost:3000` and sign in with the seeded administrator username and password. Immediately change the administrator password and update the placeholder business details under Settings. Running the seed again never overwrites an existing password.

## Validation

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm run lint
npm run typecheck
npm test
npm run build
```

The tests cover Decimal commission and receipt rules, role restrictions, inactive-session rules, cancellation-safe sales totals, print counting, stock movement direction, reusable custody, negative-stock prevention, and receive-once purchase movement behavior.

## Database and migration workflow

During development, create reviewed migrations with:

```bash
npx prisma migrate dev --name describe_change
```

Production must use committed migrations:

```bash
npx prisma migrate deploy
```

Do not use `prisma db push` as the production deployment method. The initial SQL migration includes check constraints for non-negative money, positive movement quantities, commission equality, receipt cancellation integrity, singleton settings, and inventory issue quantities. Financial and stock records use restricted foreign keys and status-based cancellation rather than hard deletion.

## Vercel deployment

1. Create a Prisma Postgres database and copy its pooled and direct connection strings.
2. Import this repository into Vercel.
3. Add all environment variables listed above to Production.
4. Deploy. `vercel.json` runs `prisma generate`, `prisma migrate deploy`, and the Next.js production build.
5. Run the seed once from a trusted environment with production credentials: `npm run db:seed`.
6. Sign in, update Settings, deactivate unused payment methods/services, and create supervisor accounts.

For larger teams, run migrations in a single CI release job before the Vercel rollout to avoid concurrent deployment jobs.

## Backups and recovery

Enable Prisma Postgres point-in-time recovery and daily backups. Before a major migration, take an on-demand backup and test restoration to a separate database. Retain backups according to local financial-record requirements. The movement ledger and audit log should be included in every backup and never selectively truncated.

## Printing

Receipt pages live at `/receipts/[id]/print`. The print button invokes `window.print()`; no Android SDK or device registration is used. Configure the Android POS browser/printer once for 58mm paper, zero/minimal margins, 100% scale, and disabled headers/footers. Long names wrap within a 54mm content area.

## Operational notes

- All monetary and quantity values are stored with PostgreSQL Decimal types. Browser values are never the financial source of truth.
- Every protected page and mutation validates the current server session; controls hidden in the UI are not treated as authorization.
- Sessions use random opaque tokens, store only token digests in PostgreSQL, use secure HTTP-only cookies, and expire after five minutes. The interface shows a countdown and signs out automatically.
- The current stock report is computed from movements plus open reusable assignments—there is no editable `currentStock` field.
- CSVs are UTF-8 and intended for spreadsheet review. The cash summary is explicitly not a full accounting profit-and-loss statement.
