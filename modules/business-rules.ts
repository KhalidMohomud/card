import { Prisma, type UserRole } from "@prisma/client";

export function calculateCommission(carCount: number, ratePerCar: string) {
  return new Prisma.Decimal(carCount).mul(ratePerCar).toDecimalPlaces(2);
}

export function receiptSnapshot(service: { id: string; name: string; price: Prisma.Decimal }, input: { paymentMethodId: string; paymentReference?: string; idempotencyKey: string }, userId: string) {
  return { serviceId: service.id, paymentMethodId: input.paymentMethodId, paymentReference: input.paymentReference, idempotencyKey: input.idempotencyKey, createdByUserId: userId, serviceNameSnapshot: service.name, servicePriceSnapshot: service.price };
}

export function roleCanManageServices(role: UserRole) { return role === "ADMIN"; }

export function reusableBalances(owned: Prisma.Decimal, issued: Prisma.Decimal, returned: Prisma.Decimal, damaged: Prisma.Decimal, lost: Prisma.Decimal) {
  const assigned = issued.sub(returned).sub(damaged).sub(lost);
  return { owned: owned.sub(damaged).sub(lost), assigned, available: owned.sub(damaged).sub(lost).sub(assigned) };
}

const incomingMovements = new Set(["PURCHASE_IN", "CONSUMABLE_RETURN_IN", "ADJUSTMENT_IN"]);
const outgoingMovements = new Set(["CONSUMABLE_ISSUE_OUT", "DAMAGED_OUT", "LOST_OUT", "ADJUSTMENT_OUT"]);
export function movementBalance(movements: { movementType: string; quantity: Prisma.Decimal }[]) {
  return movements.reduce((total, movement) => {
    if (incomingMovements.has(movement.movementType)) return total.add(movement.quantity);
    if (outgoingMovements.has(movement.movementType)) return total.sub(movement.quantity);
    return total;
  }, new Prisma.Decimal(0));
}

export function completedSales(receipts: { status: "COMPLETED" | "CANCELLED"; amount: Prisma.Decimal }[]) {
  return receipts.filter((receipt) => receipt.status === "COMPLETED").reduce((total, receipt) => total.add(receipt.amount), new Prisma.Decimal(0));
}

export function canRemoveStock(available: Prisma.Decimal, requested: Prisma.Decimal) {
  return requested.greaterThan(0) && available.greaterThanOrEqualTo(requested);
}

export function canViewSalaryExpenses(role: UserRole) { return role === "ADMIN"; }
export function canStartSession(isActive: boolean) { return isActive; }
export function nextPrintCount(current: number) { return current + 1; }
export function purchaseMovementCount(itemCount: number, alreadyReceived: boolean) { return alreadyReceived ? 0 : itemCount; }
