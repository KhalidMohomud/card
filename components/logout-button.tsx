"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return <button className="btn btn-ghost btn-block" style={{ borderColor: "#ffffff30", color: "white" }} onClick={async () => { await fetch("/api/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }}><LogOut size={15} /> Log out</button>;
}
