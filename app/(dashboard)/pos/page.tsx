import { PosClient } from "@/components/pos-client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata = { title: "POS" };
export default async function PosPage() {
  await requireUser();
  const [services, methods, settings] = await Promise.all([
    prisma.service.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.businessSetting.findUnique({ where: { id: "singleton" } }),
  ]);
  return <div className="page">
    <PosClient currency={settings?.currencyCode ?? "USD"}
      services={services.map((item) =>

        ({ id: item.id, name: item.name, description: item.description, price: item.price.toFixed(2) }))}
      methods={methods.map(({ id, name }) => ({ id, name }))} />

  </div>;
}
