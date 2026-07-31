import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordHash, verifyPassword } from "@/lib/password";
import { supervisorInput } from "@/lib/validation";

describe("authentication security", () => {
  it("stores passwords as salted scrypt hashes and verifies in constant-time form", async () => {
    const password = "Long-Test.Password-2026";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(isPasswordHash(first)).toBe(true);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    await expect(verifyPassword(first, password)).resolves.toBe(true);
    await expect(verifyPassword(first, "Wrong-Test.Password-2026")).resolves.toBe(false);
  });

  it("requires strong supervisor passwords", () => {
    expect(supervisorInput.safeParse({ fullName: "Test Supervisor", username: "tester", password: "weakpassword", role: "SUPERVISOR" }).success).toBe(false);
    expect(supervisorInput.safeParse({ fullName: "Test Supervisor", username: "tester", password: "Strong.Password-2026", role: "MANAGER" }).success).toBe(true);
  });
});
