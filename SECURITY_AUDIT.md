# SwiftWash Security Audit

Audit date: 1 August 2026  
Scope: the complete application repository, including Next.js pages and Route Handlers, Server Actions, authentication/session code, Prisma schema and migrations, PostgreSQL access patterns, validation, exports, printing, headers, dependencies, tests, and environment-variable handling.

## Executive summary

The review found no exploitable SQL injection or stored/reflected XSS in the application. Prisma query builders and tagged-template raw queries are used safely, and React renders business data as escaped text. Authentication already used salted scrypt password hashes, opaque server-side sessions, a five-minute absolute expiry, generic login failures, database-backed throttling, and secure cookie attributes.

The audit did confirm several defense and integrity gaps. All were fixed in this change set: strict same-origin checks for custom mutation endpoints, CSV formula neutralization, server-side validation of financial foreign-key choices, atomic cancellation transitions, bounded query and numeric validation, nonce-based script CSP, session replacement on sign-in, safer logging, and a vulnerable development dependency. There are no known unresolved Critical or High findings after remediation.

| Severity | Found | Fixed | Unresolved |
| --- | ---: | ---: | ---: |
| Critical | 0 | 0 | 0 |
| High | 1 | 1 | 0 |
| Medium | 5 | 5 | 0 |
| Low | 4 | 4 | 0 |

## Architecture and trust boundaries

- Browser: untrusted input source. It may submit arbitrary form fields, JSON, query strings, IDs, dates, prices, and role values.
- Next.js application: authentication, authorization, validation, business rules, rendering, and export boundary.
- PostgreSQL/Prisma: authoritative identity, session, ledger, inventory, and audit data.
- Administrative environment: database credentials and the bootstrap administrator password hash. These values must remain server-only.
- CSV consumer: an external spreadsheet application that may interpret cells as formulas.

The application recognizes three roles:

- `ADMIN`: all business operations, staff management, Settings, and Audit logs.
- `MANAGER`: business operations and Supervisor account management, but no Settings or Audit logs.
- `SUPERVISOR`: POS receipt creation and owner-scoped receipt reprinting only.

Authorization is enforced server-side in `lib/session.ts`, `lib/permissions.ts`, every protected page, every exported Server Action, and every custom API handler. Navigation visibility is not treated as a security control.

## Findings and remediation

### SW-SEC-001 — High — vulnerable transitive dependency — fixed

Exploitability: `brace-expansion` 1.1.16 was vulnerable to unbounded expansion leading to memory exhaustion (GHSA-mh99-v99m-4gvg). The vulnerable path was development-only through ESLint/minimatch, so it was not reachable from the production POS request path, but it could affect developer or CI availability.

Evidence: the initial `npm audit --audit-level=moderate` reported one High advisory. The pnpm lockfile also retained stale vulnerable resolutions.

Fix: updated both lockfiles and added npm/pnpm security overrides for patched `brace-expansion`, `postcss`, and `sharp` versions in `package.json`.

Verification: final npm and pnpm audits both report zero known vulnerabilities.

### SW-SEC-002 — Medium — incomplete CSRF validation on custom POST endpoints — fixed

Exploitability: the old origin helper accepted mutation requests with no `Origin` and compared only the host when an origin was supplied. The receipt endpoint did not call it at all. `SameSite=Strict` reduced ordinary browser exploitation but should not be the only control.

Locations: `app/api/login/route.ts`, `app/api/logout/route.ts`, `app/api/receipts/route.ts`, formerly `lib/auth-session.ts`.

Fix: added `lib/request-security.ts`. Custom mutations now require an exact scheme + host origin match, reject cross-site Fetch Metadata when present, and require JSON content types where JSON is expected. Missing and malformed origins fail closed. Next.js Server Actions retain the framework's built-in POST and Origin/Host validation.

Verification: unit tests cover missing, malformed, cross-origin, scheme-mismatched, reverse-proxy, and cross-site requests. Production smoke tests returned 403 for missing/cross-origin requests and 415 for an invalid login content type.

### SW-SEC-003 — Medium — CSV/spreadsheet formula injection — fixed

Exploitability: names, titles, suppliers, service snapshots, and other database text were correctly CSV-quoted but cells beginning with `=`, `+`, `-`, or `@` could execute as formulas when an administrator opened the export in spreadsheet software.

Location: `app/api/reports/csv/route.ts`.

Fix: centralized CSV generation in `lib/csv.ts`. Formula-like cells, including values preceded by control characters or spaces, are prefixed with an apostrophe before normal RFC-style quoting.

Verification: automated tests cover formula payloads, embedded quotes, commas, text, and numeric cells.

### SW-SEC-004 — Medium — financial reference tampering / inactive-reference use — fixed

Exploitability: a forged request could submit an inactive supplier, inventory item, expense category, payment method, or a non-Supervisor user ID. Database foreign keys prove existence but not application eligibility, so such records could produce incorrect ledgers or attribution.

Locations: `modules/expenses/service.ts`, `modules/purchases/service.ts`, `modules/inventory/catalog.ts`, `modules/inventory/service.ts`.

Fix: every referenced business entity is reloaded and checked for the required active state and role on the server. Expense checks and writes execute in a Serializable transaction. Purchase writes validate active supplier, item, and optional payment method inside their transaction. Archived categories/items cannot be newly assigned or adjusted.

### SW-SEC-005 — Medium — script CSP permitted inline script execution — fixed

Exploitability: production `script-src` previously included `'unsafe-inline'`, weakening the containment available if a future HTML injection defect were introduced.

Locations: formerly `next.config.ts`; now `proxy.ts` and `next.config.ts`.

Fix: HTML responses receive a cryptographically random nonce and `script-src 'self' 'nonce-…' 'strict-dynamic'`; `object-src` and `frame-src` are disabled, framing is denied, forms are same-origin, and production upgrades insecure requests. HSTS, COOP, CORP, nosniff, referrer, and permissions headers are also set. Development alone retains `unsafe-eval` because React/Next debugging requires it.

Verification: the production build succeeded and live normal-page and 404 responses showed matching CSP/script nonces with no `unsafe-inline` in `script-src`. The global 404 is explicitly request-rendered so it cannot serve nonce-less prerendered scripts.

### SW-SEC-006 — Low — unbounded or unvalidated query, ID, date, amount, and quantity inputs — fixed

Exploitability: malformed report dates could cause a 500, unknown report types fell through to sales, and several action IDs/booleans relied on Prisma rejection. Decimal fields allowed zero or values beyond their database precision. These were primarily availability and integrity risks, not SQL injection.

Locations: `lib/validation.ts`, receipt/report pages, CSV route, `app/actions.ts`.

Fix: added strict allowlists and bounds for report types/statuses, CUIDs, receipt IDs, booleans, page numbers, calendar dates and ordering, search length, positive money, quantities, commission counts, short references, and HTTP(S)-only logo URLs. Invalid page filters are ignored with a safe message; invalid API filters return 400.

### SW-SEC-007 — Low — concurrent cancellation could duplicate audit transitions — fixed

Exploitability: two authorized requests could both read a completed receipt or active expense before either update, leading to duplicate cancellation audit events.

Locations: `modules/receipts/service.ts`, `modules/expenses/service.ts`.

Fix: cancellation now uses an atomic conditional `updateMany` transition and requires exactly one affected row before writing the audit event.

### SW-SEC-008 — Low — previous browser session survived a successful re-login — fixed

Exploitability: signing in while presenting an older session created a second session without first invalidating the presented token. This was not classic session fixation because the new token was random, but retaining the prior session unnecessarily widened the session set.

Location: `app/api/login/route.ts`.

Fix: successful login revokes the currently presented token before creating and setting the new random token. Database sessions store only SHA-256 token digests. Password changes, user updates, disables, and logout continue to revoke applicable sessions.

### SW-SEC-009 — Low — avoidable error and audit-data exposure — fixed

Exploitability: generic helper/seed logging could emit complete error objects, and supplier audit snapshots duplicated contact details and free-form notes into the long-lived audit ledger.

Locations: `lib/errors.ts`, `prisma/seed.ts`, `modules/inventory/catalog.ts`, `app/api/receipts/route.ts`.

Fix: runtime/seed failures log only a stable operation label and error class. Supplier audit events retain the supplier identity and active state without copying contact details or notes. Browser responses remain generic and do not expose Prisma, SQL, stack, schema, or environment details.

### SW-SEC-010 — Medium — parallel login attempts could outrun failure accounting — fixed

Exploitability: the previous flow verified a password before recording the failed attempt. Several concurrent requests could all pass the initial block check and reach password verification before their failure transactions completed. Serializable conflicts could also cause an attempt not to be recorded.

Locations: `app/api/login/route.ts`, `lib/login-throttle.ts`.

Fix: each syntactically valid login attempt is now atomically reserved before any user/password lookup. Five verifications are permitted within the rolling minute; a sixth is blocked for 15 minutes. A successful login clears its username/IP counters. Serializable conflicts are retried before the request can proceed to password verification.

Verification: unit tests cover the fifth allowed attempt, sixth blocked attempt, 15-minute block time, and expired-window reset.

## SQL injection review

- No `$queryRawUnsafe` or `$executeRawUnsafe` calls exist.
- The two raw SQL uses are Prisma tagged-template queries; IDs are passed as bound parameters rather than concatenated strings.
- Search, filter, create, update, delete, login, receipt, purchase, and report paths otherwise use Prisma query builders.
- Report type/status filters are allowlisted and dates/IDs are validated before reaching the data layer.
- SQL-like username payloads are rejected; receipt search text is treated as data by Prisma `contains` filters.

Result: no confirmed SQL injection vulnerability.

## XSS review

- No `dangerouslySetInnerHTML`, DOM `innerHTML`, `document.write`, `eval`, `new Function`, or JavaScript URL rendering exists in application source.
- Receipt print fields, business settings, services, suppliers, audit JSON, flash messages, and ledger values are rendered as React text and therefore escaped.
- Free-form values are length-bounded server-side.
- Configured logo URLs are limited to HTTP(S).
- CSV injection is separately neutralized because HTML escaping does not protect spreadsheets.
- The nonce CSP provides an additional production script-execution boundary.

Result: no confirmed stored or reflected XSS vulnerability.

## Authentication and session review

- Passwords: random salt + Node `scrypt`; strict serialized-hash format; constant-time `timingSafeEqual`; 12–128 character complexity policy for new/reset passwords.
- Bootstrap: `.env` contains a password hash, not a plaintext administrator password; seeding does not overwrite an existing valid credential.
- Login: normalized/allowlisted usernames, a structurally valid dummy hash for unknown users, generic 401 errors, and database-backed username + IP throttling (5 failures/60 seconds, then 15-minute block).
- Sessions: 256-bit opaque random tokens, digest-only database storage, five-minute absolute expiry, database validation on protected reads/mutations, and invalidation for disabled users.
- Cookie: `HttpOnly`, `Secure` in production, `SameSite=Strict`, root Path, explicit expiry/Max-Age, and High priority.
- Logout: same-origin POST, database revocation, expired cookie overwrite, no-store response.
- UI expiry: the client countdown logs out and redirects at the authoritative expiry; the server independently rejects expired sessions.

## Authorization review

- All dashboard pages require a server-validated session through the protected layout.
- Settings and Audit logs call `requireAdmin` in addition to the layout.
- Operational pages call `requireManagement`; Supervisors are redirected to POS.
- Every exported Server Action re-checks Admin, Management, or authenticated-user access.
- CSV export returns 401 when unauthenticated and 403 when authenticated without report permission.
- Receipt print/reprint access is owner-scoped for Supervisors through a shared policy function.
- Staff role mass assignment is limited to Manager/Supervisor; Managers cannot create, update, disable, or delete Manager accounts.
- Disabled users cannot establish or continue a database session.

## Database and migration review

- Prisma models use typed enums, unique constraints, restrictive foreign keys, idempotency keys, and targeted indexes.
- Existing SQL migrations include nonnegative/positive numeric checks, record-state consistency checks, singleton settings enforcement, and inventory/expense integrity checks.
- Receipt price/name snapshots preserve historical truth when catalog values change.
- Purchase receipt and inventory movement posting use transactions; receive is a conditional one-time transition.
- Receipt creation uses an idempotency key and transaction retry handling.
- Inventory quantities are derived from immutable movement rows rather than a client-controlled balance.
- Audit records have no application update/delete endpoint and are Admin-only in the UI.
- `npx prisma validate` succeeded and `npx prisma migrate status` reported all five migrations applied.

## Secrets and privacy review

- `.env*` is ignored except `.env.example`.
- Git filename/history checks found only `.env.example`, which contains placeholders.
- No private keys, credential files, or `NEXT_PUBLIC_` secrets were found.
- Database URLs and the administrator password hash are read server-side only.
- Session cookies and raw tokens are never logged or returned in page data.
- Authenticated-user DTOs expose only ID, display identity, role, active state, and session expiry.
- Audit events intentionally omit password hashes, raw credentials, tokens, and supplier contact/free-form data.

## Automated and manual verification

Automated suite: 34 tests in 5 files. Security coverage includes:

- same-origin, missing-origin, cross-origin, Fetch Metadata, reverse-proxy, and content-type controls;
- token entropy/digest behavior, tampering, expiry, and disabled-user rejection;
- password salting/verifying and password-policy rejection;
- generic/validated login inputs and SQL-like payload rejection;
- Admin/Manager/Supervisor permission matrix and owner-scoped receipt access;
- Admin role mass-assignment rejection and Supervisor eligibility;
- CSV formula injection and quoting;
- absence of unsafe Prisma raw-query APIs in sensitive source;
- report type/status/date/search/page, money, and quantity boundaries;
- HTTP(S)-only URL validation and React text escaping;
- financial, inventory, idempotency, print, and business-timezone rules.

Production HTTP smoke checks confirmed:

- nonce CSP, HSTS, nosniff, deny-framing, referrer, permissions, COOP, and CORP headers;
- unauthenticated protected-page redirect to login;
- missing/cross-origin login POST returns 403;
- invalid content type returns 415;
- invalid credentials return a generic 401;
- unauthenticated receipt/report endpoints return 401 and clear stale cookies;
- sensitive responses use `Cache-Control: no-store` or Next.js private/no-store behavior.

## Commands executed

```text
rg --files
rg -n '<security sink/source patterns>' app components lib modules prisma scripts
rg -n 'export async function (POST|PUT|PATCH|DELETE)|require…' app modules lib
git log --all --name-only --pretty=format:
git ls-files
npm audit --audit-level=moderate
npm audit fix
npm audit --audit-level=high
pnpm install --lockfile-only
pnpm audit --audit-level high
npx prisma validate
npx prisma migrate status
npm test
npm run typecheck
npm run lint
npm run build
curl -sS -i <local production security smoke requests>
git diff --check
```

Final results: npm audit 0 vulnerabilities; pnpm audit no known vulnerabilities; 34/34 tests passed; Prisma schema valid and migrations current; TypeScript passed; ESLint passed; production build passed.

## Residual risks and deployment guidance

The following are not Critical/High vulnerabilities, but should remain on the operations backlog:

1. `style-src 'unsafe-inline'` remains because the current React UI uses inline style props. Script execution is nonce-protected. Moving inline styles into CSS classes would allow a fully nonce/hash-based style policy.
2. IP rate limiting and audit IP attribution assume deployment behind a trusted reverse proxy that overwrites `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, and `X-Forwarded-Proto`. Do not expose the Node process directly while accepting client-supplied forwarding headers.
3. Use separate PostgreSQL credentials for migrations and runtime. The runtime role should have only the table/sequence permissions the application needs and no schema-owner, role-management, superuser, or destructive schema privileges.
4. Database operators can still alter audit rows. If regulatory tamper evidence is required, stream audit events to append-only external storage with retention and access controls.
5. Five-minute sessions are absolute and intentionally short. Monitor customer support impact before changing them; any future renewal design should rotate tokens and keep server-side revocation.
6. Keep both lockfiles synchronized or standardize on one package manager in CI. Run dependency audit, tests, typecheck, lint, Prisma validation, and production build on every release.

## Deployment checklist

1. Deploy through HTTPS only and verify HSTS/CSP on the final Vercel domain.
2. Keep `DATABASE_URL`, `DIRECT_URL`, and `ADMIN_PASSWORD_HASH` server-only; rotate immediately if any real value was ever shared outside the deployment secret store.
3. Use a strong, unique administrator password and re-run the hash generator only for deliberate credential rotation.
4. Apply migrations before serving the new build (`prisma migrate deploy`).
5. Confirm the production reverse proxy overwrites forwarding headers.
6. Perform an Admin, Manager, Supervisor, disabled-user, expired-session, and logout acceptance pass against staging with non-production test accounts.
7. Verify CSV exports with Excel/LibreOffice and confirm formula-like values display as literal text.
8. Monitor login throttles, failed-login audit volume, session creation, cancellations, staff changes, and inventory adjustments for anomalies.
