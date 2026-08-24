import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { BarChart3, Droplets, FileClock, HandCoins, LayoutDashboard, PackagePlus, ReceiptText, Settings, ShoppingCart, UsersRound } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { LogoutButton } from "@/components/logout-button";
import { MobileNavigation } from "@/components/mobile-navigation";
import { SessionExpiry } from "@/components/session-expiry";
import { LiveSystemEvents } from "@/components/live-system-events";
import { DesktopInventoryNavigation } from "@/components/inventory-navigation";
import companyLogo from "@/logo.jpeg";

const managementLinks = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["POS", "/pos", ShoppingCart], ["Receipts", "/receipts", ReceiptText],
  ["Services", "/services", Droplets], ["Staff", "/supervisors", UsersRound], ["Expenses", "/expenses", HandCoins],
  ["Purchases", "/purchases", PackagePlus], ["Reports", "/reports", BarChart3],
] as const;
const adminLinks = [
  ...managementLinks,
  ["Settings", "/settings", Settings], ["Audit logs", "/audit-logs", FileClock],
] as const;
const supervisorLinks = [["Open POS", "/pos", ShoppingCart]] as const;

export function Shell({ user, children }: { user: { fullName: string; username?: string | null; role: UserRole; sessionExpiresAt: string }; children: React.ReactNode }) {
  const links = user.role === "ADMIN" ? adminLinks : user.role === "MANAGER" ? managementLinks : supervisorLinks;
  const homeHref = user.role === "SUPERVISOR" ? "/pos" : "/dashboard";
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href={homeHref}>
        <span className="brand-mark">
          <Image className="brand-logo" src={companyLogo} alt="" priority />
        </span>
        <span>
          <strong>EcofriendLC</strong>
          <small>Car wash POS</small>
        </span>
      </Link>
      <nav className="nav">{links.map(([label, href, Icon]) => <Fragment key={href}>{label === "Purchases" && <DesktopInventoryNavigation />}<Link className="nav-link" href={href}><Icon size={18} />{label}</Link></Fragment>)}
      </nav>
      <div className="sidebar-user">
        <strong>{user.fullName}</strong>
        <small>{user.role.toLowerCase()}</small>
        <LogoutButton />
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <div><p>EcofriendLC operations</p>
        </div>
        <div className="topbar-status">
          <LiveSystemEvents />
          <SessionExpiry expiresAt={user.sessionExpiresAt} />
        </div>
      </header>{children}
    </main>
    <MobileNavigation user={user} />
  </div>;
}
