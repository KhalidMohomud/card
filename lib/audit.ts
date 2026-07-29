import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
};

export async function requestMetadata() {
  const values = await headers();
  return {
    ipAddress: values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? values.get("x-real-ip"),
    userAgent: values.get("user-agent"),
  };
}

export async function audit(input: AuditInput) {
  const metadata = await requestMetadata();
  return prisma.auditLog.create({ data: { ...input, ...metadata } });
}
