"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { BarChart3, Droplets, FileClock, HandCoins, LayoutDashboard, Menu, PackagePlus, ReceiptText, Settings, ShoppingCart, UserRound, UsersRound, X } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";
import { MobileInventoryNavigation } from "@/components/inventory-navigation";

const managementMenuLinks = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["Open POS", "/pos", ShoppingCart], ["Receipts", "/receipts", ReceiptText],
  ["Services", "/services", Droplets], ["Staff", "/supervisors", UsersRound], ["Expenses", "/expenses", HandCoins],
  ["Purchases", "/purchases", PackagePlus], ["Reports", "/reports", BarChart3],
] as const;
const adminMenuLinks = [
  ...managementMenuLinks,
  ["Settings", "/settings", Settings], ["Audit logs", "/audit-logs", FileClock],
] as const;

export function MobileNavigation({ user }: { user: { fullName: string; username?: string | null; role: UserRole } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initials = useMemo(() => user.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(""), [user.fullName]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  const primaryLinks = user.role !== "SUPERVISOR"
    ? [["Home", "/dashboard", LayoutDashboard], ["POS", "/pos", ShoppingCart], ["Reports", "/reports", BarChart3]] as const
    : [["Open POS", "/pos", ShoppingCart]] as const;
  const menuLinks = user.role === "ADMIN" ? adminMenuLinks : managementMenuLinks;

  return <>
    <nav className={`mobile-nav ${user.role === "SUPERVISOR" ? "mobile-nav-supervisor" : ""}`} aria-label="Mobile navigation">
      {primaryLinks.map(([label, href, Icon]) => <Link className={pathname === href ? "active" : ""} href={href} key={href}><Icon size={20} /><span>{label}</span></Link>)}
      <button className={open ? "active" : ""} type="button" aria-expanded={open} aria-controls="mobile-account-sheet" onClick={() => setOpen(true)}>{user.role !== "SUPERVISOR" ? <Menu size={20} /> : <UserRound size={20} />}<span>{user.role !== "SUPERVISOR" ? "Menu" : "Account"}</span></button>
    </nav>
    {open && <div className="mobile-drawer-layer"><button className="mobile-drawer-backdrop" type="button" aria-label="Close menu" onClick={() => setOpen(false)} /><section className="mobile-account-sheet" id="mobile-account-sheet" role="dialog" aria-modal="true" aria-label="Account and navigation">
      <div className="mobile-sheet-handle" />
      <div className="mobile-profile"><span className="mobile-avatar">{initials || "U"}</span><div><strong>{user.fullName}</strong><small>{user.username ? `@${user.username}` : user.role.toLowerCase()}</small></div><button className="icon-button" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={20} /></button></div>
      {user.role !== "SUPERVISOR" && <><p className="mobile-sheet-label">Navigation</p><div className="mobile-menu-grid">{menuLinks.map(([label, href, Icon]) => <Fragment key={href}>{label === "Purchases" && <MobileInventoryNavigation onNavigate={() => setOpen(false)} />}<Link className={pathname === href ? "active" : ""} href={href} onClick={() => setOpen(false)}><Icon size={19} /><span>{label}</span></Link></Fragment>)}</div></>}
      {user.role === "SUPERVISOR" && <div className="mobile-role-card"><UserRound size={19} /><div><strong>Supervisor profile</strong><small>POS access only</small></div></div>}
      <div className="mobile-logout"><LogoutButton /></div>
    </section></div>}
  </>;
}
