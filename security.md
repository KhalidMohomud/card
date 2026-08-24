# EcofriendLC Web Security Assessment

**Assessment date:** 24 August 2026  
**Application:** EcofriendLC POS  
**Baseline:** OWASP Top 10:2025  
**Outcome:** All confirmed code and dependency findings from this review were remediated and verified. Credential rotation remains an urgent deployment action because database and administrator credentials were shared in the project conversation.

## Executive summary

The application was reviewed against the current [OWASP Top 10:2025](https://owasp.org/Top10/). The review covered application code, authentication and session controls, authorization boundaries, API request handling, Prisma database access, dependency lockfiles, response headers, logging, configuration, automated tests, an optimized production build, and runtime HTTP checks.

Six hardening findings were confirmed and fixed:

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| SEC-01 | High | Nine known dependency vulnerabilities across five advisory families | Patched through exact dependency overrides; both npm and pnpm audits now report zero known vulnerabilities |
| SEC-02 | Medium | JSON API bodies had no application-level byte limit | Added streamed byte limits, declared-length validation, and explicit 413 responses |
| SEC-03 | Medium | Forwarded origin and client-IP headers were trusted implicitly | Forwarded headers are now ignored unless running on Vercel or `TRUST_PROXY_HEADERS=true`; IP values are syntax-validated |
| SEC-04 | Medium | Report exports and some pagination inputs could consume excessive resources | Report ranges are limited to 366 days, exports to 50,000 rows, pagination to 10,000 pages, and receipt IDs to positive integers |
| SEC-05 | Low | Login infrastructure errors and invalid credentials shared one response path; receipt failures were all reported as client errors | Added explicit malformed-input, authorization, conflict, dependency failure, and internal-error handling without exposing internals |
| SEC-06 | Low | The environment template was empty | Added safe placeholders and trusted-proxy deployment guidance to `.env.example` |

No SQL injection, stored/reflected XSS, unsafe raw Prisma query use, client-controlled role assignment, or committed production secret value was found during the source review. This is a point-in-time assessment, not a guarantee that the application is free from every vulnerability.

## OWASP Top 10:2025 coverage

| OWASP category | Result | Controls verified or added |
| --- | --- | --- |
| A01 Broken Access Control | Pass | Central role-permission matrix; authenticated page guards; admin/management guards; supervisor receipt ownership checks; API authorization; unauthenticated receipt mutation returned 401 |
| A02 Security Misconfiguration | Pass with one residual item | `X-Content-Type-Options`, frame denial, referrer policy, permissions policy, COOP/CORP, production HSTS, nonce-based CSP, no framework signature, no-store auth/API responses, documented environment configuration. CSP still permits inline styles; see recommendations |
| A03 Software Supply Chain Failures | Fixed | Lockfiles reviewed; vulnerable transitive versions of `brace-expansion`, `deepmerge-ts`, `js-yaml`, `nanoid`, and `postcss` overridden to patched releases; npm and pnpm audits clean |
| A04 Cryptographic Failures | Pass | Passwords use salted scrypt hashes; sessions use high-entropy opaque tokens and store only SHA-256 token digests; cookies are HttpOnly, SameSite Strict, Secure in production, short-lived, and database-revocable; PostgreSQL connection configuration requires TLS |
| A05 Injection | Pass | Zod validation and bounds; parameterized Prisma methods/tagged templates only; no unsafe Prisma raw APIs; React output escaping; CSV formula neutralization; strict username and filter allowlists |
| A06 Insecure Design | Improved | Database-backed login throttling, dummy password verification for unknown users, idempotent receipt creation, short sessions, fail-closed origin checks, bounded request bodies, report range/row limits, and bounded pagination |
| A07 Authentication Failures | Pass | Generic invalid-credential response, account-active check, timing-resistant unknown-user path, five-attempt throttle and block window, session rotation on login, server-side logout revocation, expired-session rejection |
| A08 Software or Data Integrity Failures | Pass with operational recommendation | Deterministic lockfiles, dependency audit, transactional business writes, idempotency keys, and audit records. Add automated dependency review and protected CI before production releases |
| A09 Security Logging and Alerting Failures | Pass with operational recommendation | Login success/failure/block/rejection/internal errors and business-critical mutations are audited with validated proxy metadata. Export logs to append-only external storage and alert on repeated failures in production |
| A10 Mishandling of Exceptional Conditions | Fixed | Malformed JSON returns 400, oversized requests 413, unsupported media 415, unavailable catalog data 409, authorization failure 403, and unexpected receipt errors 500. Errors expose generic messages and log only the error class/name |

## Remediation details

### Request boundaries and trusted proxies

`lib/request-security.ts` now provides one boundary for same-origin enforcement, content-type checks, trusted client-IP extraction, and limited JSON parsing. Login bodies are limited to 2 KiB and receipt bodies to 8 KiB. The limit is enforced against both `Content-Length` and the actual streamed byte count, so chunked requests cannot bypass it.

Forwarded headers are accepted only when Vercel identifies the runtime or an operator explicitly sets `TRUST_PROXY_HEADERS=true`. Self-hosted deployments must enable this only behind a trusted reverse proxy that overwrites user-supplied `X-Forwarded-*` headers.

### Authentication and sessions

The login route distinguishes invalid input from invalid credentials and infrastructure failure. It preserves generic credential errors to prevent account enumeration, records security events asynchronously, rotates any presented session after successful authentication, and keeps database-backed username/IP throttling. IP throttling activates only when the client IP comes from a trusted proxy; username throttling always remains active.

### Input validation and resource limits

Receipt IDs must be positive integers. Pagination cannot exceed 10,000. Audit filters are limited to 120 characters. CSV reports are limited to a 366-day range and 50,000 records, returning a generic 422 response when the result would be too large. These controls reduce memory, database, and cache-key abuse.

### Dependency remediation

Initial dependency audit results:

- 9 total advisories: 6 high and 3 moderate.
- Affected families: `brace-expansion`, `deepmerge-ts`, `js-yaml`, `nanoid`, and `postcss`.

Patched versions are pinned through npm and pnpm overrides and recorded in both lockfiles. Final results:

- `npm audit --audit-level=moderate`: **0 vulnerabilities**.
- `pnpm audit --audit-level=moderate`: **No known vulnerabilities found**.

## Verification evidence

| Check | Result |
| --- | --- |
| Automated security/unit tests | 5 files passed; 38 tests passed |
| Production build and TypeScript | Passed with Next.js 16.2.12 |
| ESLint | 0 errors; 2 unrelated unused-symbol warnings in the reports page |
| Patch whitespace validation | Passed |
| npm dependency audit | 0 vulnerabilities |
| pnpm dependency audit | No known vulnerabilities |
| Unsafe raw Prisma API scan | No `queryRawUnsafe` or `executeRawUnsafe` use found |
| Dangerous rendering/execution scan | No `dangerouslySetInnerHTML`, `eval`, or `new Function` use found in application source |
| Tracked secret-file review | Only `.env.example` is tracked; real `.env*` files are ignored |

Runtime checks against the optimized local production server:

| Test | Expected protection | Observed |
| --- | --- | --- |
| Login document | Security headers present | 200 with nonce CSP, HSTS, DENY framing, nosniff, COOP/CORP, referrer and permissions policies |
| Cross-origin login POST | Reject CSRF/origin mismatch | 403 |
| Login POST with `text/plain` | Reject unsupported content type | 415 |
| Login POST with malformed JSON | Reject invalid request | 400 |
| Login POST with oversized declared body | Reject oversized request | 413 |
| Receipt POST without a session | Reject unauthenticated mutation | 401 and expired session cookie |

## Required deployment actions

1. **Rotate the PostgreSQL credentials immediately.** A database URL containing credentials was shared in the conversation, so it must be considered exposed. Update the deployment secrets after rotation and revoke the old credential.
2. **Change the administrator password before production use.** The supplied password was also shared in the conversation. Use a new unique password of at least 16 characters and store it only in a password manager.
3. Keep `TRUST_PROXY_HEADERS=false` for direct/self-hosted access. Enable it only when a trusted reverse proxy overwrites forwarded headers. Vercel is detected automatically.
4. Run database migrations and deploy from the updated lockfile. Repeat tests and audits in CI on every release.
5. Configure alerts for repeated `LOGIN_FAILED`, `LOGIN_BLOCKED`, `LOGIN_REJECTED`, and `LOGIN_ERROR` events and export audit logs to append-only storage.

## Residual risks and recommended follow-up

- The CSP uses `style-src 'unsafe-inline'` because the current UI contains inline styles. Move those styles into CSS classes, then remove this exception.
- This review did not test the public hosting perimeter, TLS certificate configuration, cloud database access controls, backups, WAF/rate limits, DNS, or denial-of-service capacity. Perform an authorized external penetration test against staging before public launch.
- Database administrators can modify primary-database audit rows. Replicate security events to append-only external storage for stronger non-repudiation.
- Add automated dependency update review, secret scanning, SAST, and a staging DAST scan (for example, OWASP ZAP) to CI.
- Reassess authorization with separate admin, manager, and supervisor test accounts whenever new routes or server actions are added.

## Files changed by this security remediation

- `lib/request-security.ts`
- `lib/auth-session.ts`
- `lib/login-throttle.ts`
- `lib/audit.ts`
- `lib/validation.ts`
- `app/api/login/route.ts`
- `app/api/receipts/route.ts`
- `app/api/reports/csv/route.ts`
- `app/(dashboard)/audit-logs/page.tsx`
- `app/(dashboard)/expenses/page.tsx`
- `app/receipts/[id]/print/page.tsx`
- `tests/security-controls.test.ts`
- `.env.example`
- `package.json`, `package-lock.json`, and `pnpm-lock.yaml`

## References

- OWASP Top 10:2025: https://owasp.org/Top10/
- OWASP Top 10 project: https://owasp.org/www-project-top-ten/

