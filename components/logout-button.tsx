"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  return <button className="btn btn-ghost btn-block logout-button" onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.replace("/login"); }}><LogOut size={15} /> Log out</button>;
}
