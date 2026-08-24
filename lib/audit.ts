import "server-only";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/request-security";

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
    ipAddress: clientIpFromHeaders(values),
    userAgent: values.get("user-agent"),
  };
}

export async function audit(input: AuditInput) {
  const metadata = await requestMetadata();
  return prisma.auditLog.create({ data: { ...input, ...metadata } });
}
