import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";

describe("role permissions", () => {
  it("allows managers to operate the business", () => {
    expect(can("MANAGER", "receipt:create")).toBe(true);
    expect(can("MANAGER", "receipt:view-all")).toBe(true);
    expect(can("MANAGER", "service:manage")).toBe(true);
    expect(can("MANAGER", "user:manage")).toBe(true);
    expect(can("MANAGER", "expense:manage")).toBe(true);
    expect(can("MANAGER", "inventory:manage")).toBe(true);
    expect(can("MANAGER", "report:view")).toBe(true);
  });

  it("keeps settings and audit logs administrator-only", () => {
    expect(can("MANAGER", "settings:manage")).toBe(false);
    expect(can("MANAGER", "audit:view")).toBe(false);
    expect(can("ADMIN", "settings:manage")).toBe(true);
    expect(can("ADMIN", "audit:view")).toBe(true);
  });
});
