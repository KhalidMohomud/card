import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { z } from "zod";
import { isPasswordHash } from "../lib/password";

const prisma = new PrismaClient();
const env = z.object({
  ADMIN_NAME: z.string().min(2),
  ADMIN_USERNAME: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/),
  ADMIN_PASSWORD_HASH: z.string().refine(isPasswordHash, "Run npm run auth:hash-password and use the generated scrypt hash"),
}).parse(process.env);

async function main() {
  const username = env.ADMIN_USERNAME.toLowerCase();
  const admin = await prisma.user.upsert({
    where: { username },
    update: { name: env.ADMIN_NAME, fullName: env.ADMIN_NAME, displayUsername: env.ADMIN_USERNAME, role: UserRole.ADMIN, isActive: true },
    create: { name: env.ADMIN_NAME, fullName: env.ADMIN_NAME, email: `${username}@users.swiftwash.invalid`, username, displayUsername: env.ADMIN_USERNAME, role: UserRole.ADMIN, isActive: true },
  });
  const credential = await prisma.account.findFirst({
    where: { providerId: "credential", userId: admin.id },
    select: { id: true, password: true },
  });
  if (credential) {
    await prisma.account.update({
      where: { id: credential.id },
      data: {
        accountId: admin.id,
        ...(!credential.password || !isPasswordHash(credential.password) ? { password: env.ADMIN_PASSWORD_HASH } : {}),
      },
    });
  } else {
    await prisma.account.create({
      data: { providerId: "credential", accountId: admin.id, userId: admin.id, password: env.ADMIN_PASSWORD_HASH },
    });
  }

  for (const service of [{ name: "V8", price: "10.00", description: "Full-size vehicle wash" }, { name: "Moto", price: "3.00", description: "Motorcycle wash" }]) {
    await prisma.service.upsert({ where: { name: service.name }, update: {}, create: service });
  }
  for (const name of ["Cash", "EVC Plus", "ZAAD", "Sahal", "Bank Transfer"]) {
    await prisma.paymentMethod.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of ["Rent", "Water", "Electricity", "Fuel", "Maintenance", "Transport", "Internet", "Other"]) {
    await prisma.expenseCategory.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of ["Chemicals", "Cleaning supplies", "Tools", "Machines", "Safety equipment", "Other"]) {
    await prisma.inventoryCategory.upsert({ where: { name }, update: {}, create: { name } });
  }
  await prisma.businessSetting.upsert({
    where: { id: "singleton" }, update: {},
    create: { id: "singleton", businessName: "SwiftWash Car Wash — Update in Settings", phone: "", email: "", address: "", currencyCode: "USD", receiptFooter: "Thank You" },
  });
  await prisma.auditLog.create({ data: { userId: admin.id, action: "SEED_COMPLETED", entityType: "System", newValues: { services: 2, paymentMethods: 5 } } });
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => prisma.$disconnect());
