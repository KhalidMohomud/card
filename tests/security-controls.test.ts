import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createCsv } from "@/lib/csv";
import { canAccessReceipt } from "@/lib/permissions";
import { hasJsonContentType, isSameOriginMutation } from "@/lib/request-security";
import { createSessionToken, isUsableSessionRecord, sessionTokenDigest } from "@/lib/session-token";
import { issueCloseInput, issueInput, loginInput, purchaseInput, receiptFilterInput, reportFilterInput, settingsInput, stocktakeInput, supervisorInput } from "@/lib/validation";
import { isEligibleSupervisor } from "@/modules/business-rules";
import { LOGIN_BLOCK_MS, nextLoginThrottle } from "@/lib/login-throttle-policy";

function mutationRequest(origin?: string, extraHeaders: Record<string, string> = {}) {
  return new Request("https://swiftwash.example/api/login", {
    method: "POST",
    headers: {
      host: "swiftwash.example",
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
      ...extraHeaders,
    },
  });
}

describe("CSRF and request-boundary controls", () => {
  it("accepts only exact same-origin mutation requests", () => {
    expect(isSameOriginMutation(mutationRequest("https://swiftwash.example"))).toBe(true);
    expect(isSameOriginMutation(mutationRequest())).toBe(false);
    expect(isSameOriginMutation(mutationRequest("https://evil.example"))).toBe(false);
    expect(isSameOriginMutation(mutationRequest("http://swiftwash.example"))).toBe(false);
    expect(isSameOriginMutation(mutationRequest("https://swiftwash.example", { "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("handles an HTTPS reverse proxy without trusting comma-appended values", () => {
    const request = new Request("http://internal:3000/api/login", {
      method: "POST",
      headers: {
        host: "internal:3000",
        origin: "https://pos.example",
        "x-forwarded-host": "pos.example, attacker.example",
        "x-forwarded-proto": "https, http",
      },
    });
    expect(isSameOriginMutation(request)).toBe(true);
  });

  it("requires JSON for JSON mutation endpoints", () => {
    expect(hasJsonContentType(mutationRequest("https://swiftwash.example"))).toBe(true);
    expect(hasJsonContentType(mutationRequest("https://swiftwash.example", { "content-type": "text/plain" }))).toBe(false);
  });
});

describe("session and authentication controls", () => {
  it("generates high-entropy tokens and stores only deterministic digests", () => {
    const first = createSessionToken();
    const second = createSessionToken();
    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(43);
    expect(sessionTokenDigest(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionTokenDigest(first)).not.toContain(first);
    expect(sessionTokenDigest(`${first}tampered`)).not.toBe(sessionTokenDigest(first));
  });

  it("rejects expired sessions and disabled users", () => {
    const now = Date.now();
    expect(isUsableSessionRecord(new Date(now + 1_000), true, now)).toBe(true);
    expect(isUsableSessionRecord(new Date(now - 1), true, now)).toBe(false);
    expect(isUsableSessionRecord(new Date(now + 1_000), false, now)).toBe(false);
  });

  it("allows five attempts, blocks before a sixth verification, and resets after the window", () => {
    const now = new Date("2026-08-01T08:00:00.000Z");
    const fifth = nextLoginThrottle({ attempts: 4, windowStartedAt: new Date(now.getTime() - 1_000), blockedUntil: null }, now);
    expect(fifth.attempts).toBe(5);
    expect(fifth.blockedUntil).toBeNull();
    const sixth = nextLoginThrottle({ attempts: fifth.attempts, windowStartedAt: fifth.windowStartedAt, blockedUntil: fifth.blockedUntil }, now);
    expect(sixth.blockedUntil?.getTime()).toBe(now.getTime() + LOGIN_BLOCK_MS);
    const reset = nextLoginThrottle({ attempts: 99, windowStartedAt: new Date(now.getTime() - 61_000), blockedUntil: null }, now);
    expect(reset.attempts).toBe(1);
  });

  it("normalizes usernames and rejects SQL-like credential payloads", () => {
    expect(loginInput.parse({ username: "@@Manager_1", password: "Password.2026" }).username).toBe("manager_1");
    expect(loginInput.safeParse({ username: "admin' OR 1=1--", password: "anything" }).success).toBe(false);
    expect(loginInput.safeParse({ username: "admin", password: "x".repeat(129) }).success).toBe(false);
  });
});

describe("authorization and mass-assignment controls", () => {
  it("keeps supervisor receipt access owner-scoped", () => {
    expect(canAccessReceipt("SUPERVISOR", "user-a", "user-a")).toBe(true);
    expect(canAccessReceipt("SUPERVISOR", "user-a", "user-b")).toBe(false);
    expect(canAccessReceipt("MANAGER", "manager", "user-b")).toBe(true);
  });

  it("does not permit an administrator role through staff forms", () => {
    const payload = { fullName: "Test User", username: "test.user", password: "Strong.Password-2026", role: "ADMIN" };
    expect(supervisorInput.safeParse(payload).success).toBe(false);
    expect(isEligibleSupervisor("MANAGER", true)).toBe(false);
    expect(isEligibleSupervisor("SUPERVISOR", false)).toBe(false);
    expect(isEligibleSupervisor("SUPERVISOR", true)).toBe(true);
  });
});

describe("injection and validation controls", () => {
  it("neutralizes spreadsheet formulas while preserving CSV quoting", () => {
    const output = createCsv([["Name", "Amount"], ["=HYPERLINK(\"https://evil.example\")", "+10"], ["safe, value", 12]]);
    expect(output).toContain("\"'=HYPERLINK(\"\"https://evil.example\"\")\"");
    expect(output).toContain("\"'+10\"");
    expect(output).toContain("\"safe, value\"");
  });

  it("relies only on parameterized Prisma APIs in security-sensitive source", () => {
    const source = [
      "modules/receipts/service.ts",
      "lib/cached-data.ts",
      "app/receipts/[id]/print/page.tsx",
      "app/api/reports/csv/route.ts",
      "app/actions.ts",
    ].map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toMatch(/\$(?:queryRawUnsafe|executeRawUnsafe)/);
  });

  it("bounds report filters, dates, money, and quantities", () => {
    expect(receiptFilterInput.safeParse({ q: "x".repeat(121) }).success).toBe(false);
    expect(receiptFilterInput.safeParse({ status: "DROP TABLE Receipt" }).success).toBe(false);
    expect(reportFilterInput.safeParse({ type: "../../etc/passwd" }).success).toBe(false);
    expect(reportFilterInput.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(false);
    expect(reportFilterInput.safeParse({ from: "2026-08-02", to: "2026-08-01" }).success).toBe(false);
    const basePurchase = { supplierId: "cm12345678901234567890123", purchaseDate: new Date(), paymentStatus: "PAID" };
    expect(purchaseInput.safeParse({ ...basePurchase, items: [{ inventoryItemId: "cm12345678901234567890124", quantity: "1", unitCost: "1" }] }).success).toBe(true);
    expect(purchaseInput.safeParse({ ...basePurchase, items: [{ inventoryItemId: "cm12345678901234567890124", quantity: "1", unitCost: "0" }] }).success).toBe(false);
    expect(purchaseInput.safeParse({ ...basePurchase, items: [{ inventoryItemId: "cm12345678901234567890124", quantity: "1000000000", unitCost: "1" }] }).success).toBe(false);
  });

  it("allows only HTTP(S) logo URLs", () => {
    const settings = { businessName: "SwiftWash", phone: "", email: "", address: "", currencyCode: "USD", receiptFooter: "Thank you" };
    expect(settingsInput.safeParse({ ...settings, logoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(settingsInput.safeParse({ ...settings, logoUrl: "https://cdn.example/logo.png" }).success).toBe(true);
  });

  it("validates complete multi-line inventory handovers and reconciliation payloads", () => {
    const supervisorUserId = "cm12345678901234567890123";
    const firstItem = "cm12345678901234567890124";
    const secondItem = "cm12345678901234567890125";
    const handover = { supervisorUserId, issueDate: new Date(), items: [{ inventoryItemId: firstItem, quantity: "5", conditionOut: "GOOD" }, { inventoryItemId: secondItem, quantity: "2", conditionOut: "GOOD" }] };
    expect(issueInput.safeParse(handover).success).toBe(true);
    expect(issueInput.safeParse({ ...handover, items: [handover.items[0], handover.items[0]] }).success).toBe(false);
    expect(issueCloseInput.safeParse({ issueId: supervisorUserId, items: [{ issueItemId: firstItem, returned: "1", damaged: "0", lost: "0", conditionIn: "GOOD" }, { issueItemId: secondItem, returned: "2", damaged: "0", lost: "0", conditionIn: "GOOD" }] }).success).toBe(true);
    expect(stocktakeInput.safeParse({ inventoryItemId: firstItem, countedAvailable: "0", reason: "Month-end physical count" }).success).toBe(true);
  });

  it("escapes stored business text when React renders it", () => {
    const attack = "<script>globalThis.pwned=true</script><img src=x onerror=alert(1)>";
    const html = renderToStaticMarkup(createElement("div", null, attack));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });
});
