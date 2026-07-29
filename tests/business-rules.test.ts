import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateCommission, canRemoveStock, canStartSession, canViewSalaryExpenses, completedSales, movementBalance, nextPrintCount, purchaseMovementCount, receiptSnapshot, reusableBalances, roleCanManageServices } from "@/modules/business-rules";

describe("financial business rules", () => {
  it("uses the database service price and ignores any client amount", () => {
    const input = { paymentMethodId: "pay_1", idempotencyKey: "key", amount: "0.01" };
    const result = receiptSnapshot({ id: "service_1", name: "V8", price: new Prisma.Decimal("10.00") }, input, "user_1");
    expect(result.servicePriceSnapshot.toFixed(2)).toBe("10.00");
    expect(result).not.toHaveProperty("amount");
  });

  it("calculates worker commission using Decimal arithmetic", () => {
    expect(calculateCommission(10, "1.25").toFixed(2)).toBe("12.50");
  });

  it("does not allow supervisors to manage services", () => {
    expect(roleCanManageServices("SUPERVISOR")).toBe(false);
    expect(roleCanManageServices("ADMIN")).toBe(true);
  });

  it("keeps salary expenses admin-only and blocks inactive sessions", () => {
    expect(canViewSalaryExpenses("SUPERVISOR")).toBe(false);
    expect(canViewSalaryExpenses("ADMIN")).toBe(true);
    expect(canStartSession(false)).toBe(false);
  });

  it("excludes cancelled receipts from completed sales", () => {
    expect(completedSales([{ status: "COMPLETED", amount: new Prisma.Decimal(10) }, { status: "CANCELLED", amount: new Prisma.Decimal(50) }]).toString()).toBe("10");
  });

  it("increments print count without creating receipt data", () => {
    expect(nextPrintCount(2)).toBe(3);
  });
});

describe("inventory ledger rules", () => {
  it("calculates consumable stock from signed movement types", () => {
    const balance = movementBalance([
      { movementType: "PURCHASE_IN", quantity: new Prisma.Decimal(20) },
      { movementType: "CONSUMABLE_ISSUE_OUT", quantity: new Prisma.Decimal(6) },
      { movementType: "CONSUMABLE_RETURN_IN", quantity: new Prisma.Decimal(1) },
    ]);
    expect(balance.toString()).toBe("15");
  });

  it("keeps reusable issued items owned while reducing available quantity", () => {
    const result = reusableBalances(new Prisma.Decimal(10), new Prisma.Decimal(4), new Prisma.Decimal(0), new Prisma.Decimal(0), new Prisma.Decimal(0));
    expect(result.owned.toString()).toBe("10"); expect(result.assigned.toString()).toBe("4"); expect(result.available.toString()).toBe("6");
  });

  it("restores available reusable stock on return and reduces owned stock on loss", () => {
    const returned = reusableBalances(new Prisma.Decimal(10), new Prisma.Decimal(4), new Prisma.Decimal(4), new Prisma.Decimal(0), new Prisma.Decimal(0));
    expect(returned.available.toString()).toBe("10");
    const lost = reusableBalances(new Prisma.Decimal(10), new Prisma.Decimal(4), new Prisma.Decimal(3), new Prisma.Decimal(0), new Prisma.Decimal(1));
    expect(lost.owned.toString()).toBe("9"); expect(lost.assigned.toString()).toBe("0"); expect(lost.available.toString()).toBe("9");
  });

  it("prevents stock from becoming negative", () => {
    expect(canRemoveStock(new Prisma.Decimal(3), new Prisma.Decimal(4))).toBe(false);
    expect(canRemoveStock(new Prisma.Decimal(3), new Prisma.Decimal(3))).toBe(true);
  });

  it("creates purchase movements once", () => {
    expect(purchaseMovementCount(3, false)).toBe(3);
    expect(purchaseMovementCount(3, true)).toBe(0);
  });
});
