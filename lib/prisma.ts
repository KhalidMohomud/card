import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
import { clientIpFromHeaders } from "@/lib/request-security";

async function currentRequestMetadata() {
  try {
    const values = await headers();
    return {
      ipAddress: clientIpFromHeaders(values),
      userAgent: values.get("user-agent")?.slice(0, 500) ?? null,
    };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends({
    query: {
      auditLog: {
        async create({ args, query }) {
          if (args.data.ipAddress === undefined && args.data.userAgent === undefined) {
            args.data = { ...args.data, ...await currentRequestMetadata() };
          }
          return query(args);
        },
      },
    },
  });
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;
export type AppTransactionClient = Parameters<Parameters<AppPrismaClient["$transaction"]>[0]>[0];
const globalForPrisma = globalThis as unknown as { prisma?: AppPrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
