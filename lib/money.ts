import { Prisma } from "@prisma/client";

export function decimal(value: string | number | Prisma.Decimal) {
  return new Prisma.Decimal(value);
}

export function multiplyMoney(quantity: string | number, rate: string | number) {
  return decimal(quantity).mul(decimal(rate)).toDecimalPlaces(2);
}

export function formatMoney(value: Prisma.Decimal | string | number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(decimal(value).toNumber());
}

export function serializeDecimal(value: Prisma.Decimal | null | undefined) {
  return value?.toFixed(2) ?? null;
}
