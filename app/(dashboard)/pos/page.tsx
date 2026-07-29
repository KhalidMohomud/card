import { PosClient } from "@/components/pos-client";
import { getCatalogData } from "@/lib/cached-data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "POS" };
export default async function PosPage() {
  await requireUser();
  const { services, methods, settings } = await getCatalogData();
  return <div className="page">
    <PosClient currency={settings?.currencyCode ?? "USD"}
      services={services.filter((item) => item.isActive).map(({ id, name, description, price }) => ({ id, name, description, price }))}
      methods={methods.filter((item) => item.isActive).map(({ id, name }) => ({ id, name }))} />

  </div>;
}
