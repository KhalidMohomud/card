import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); return <Shell user={user}>{children}</Shell>;
}
