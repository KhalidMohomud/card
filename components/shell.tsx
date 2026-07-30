import Link from "next/link";
import { BarChart3, Boxes, Droplets, FileClock, HandCoins, LayoutDashboard, PackagePlus, ReceiptText, Settings, ShoppingCart, UsersRound } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { LogoutButton } from "@/components/logout-button";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SessionExpiry } from "@/components/session-expiry";

const adminLinks = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["POS", "/pos", ShoppingCart], ["Receipts", "/receipts", ReceiptText],
  ["Services", "/services", Droplets], ["Supervisors", "/supervisors", UsersRound], ["Expenses", "/expenses", HandCoins],
  ["Inventory", "/inventory", Boxes], ["Purchases", "/purchases", PackagePlus], ["Reports", "/reports", BarChart3],
  ["Settings", "/settings", Settings], ["Audit logs", "/audit-logs", FileClock],
] as const;
const supervisorLinks = [["Open POS", "/pos", ShoppingCart]] as const;

export function Shell({ user, children }: { user: { fullName: string; username?: string | null; role: UserRole; sessionExpiresAt: string }; children: React.ReactNode }) {
  const links = user.role === "ADMIN" ? adminLinks : supervisorLinks;
  const homeHref = user.role === "ADMIN" ? "/dashboard" : "/pos";
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href={homeHref}>
        <span className="brand-mark">
          <Droplets size={23} />
        </span>
        <span>
          <strong>SwiftWash</strong>
          <small>Operations POS</small>
        </span>
      </Link>
      <nav className="nav">{links.map(([label, href, Icon]) => <Link className="nav-link" href={href} key={href}>
        <Icon size={18} />
        {label}
      </Link>)}
      </nav>
      <div className="sidebar-user">
        <strong>{user.fullName}</strong>
        <small>{user.role.toLowerCase()}</small>
        <LogoutButton />
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><p>Car wash operations</p>
        </div><SessionExpiry expiresAt={user.sessionExpiresAt} />
      </header>{children}
    </main>
    <MobileNavigation user={user} />
  </div>;
}
