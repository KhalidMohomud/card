"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ChevronDown, ClipboardList, LayoutGrid, Tags, Truck, UsersRound } from "lucide-react";
import { useState } from "react";

const inventoryLinks = [
  ["Overview", "/inventory", LayoutGrid],
  ["Inventory items", "/inventory/items", ClipboardList],
  ["Categories", "/inventory/categories", Tags],
  ["Suppliers", "/inventory/suppliers", UsersRound],
  ["Issues & returns", "/inventory/issues", Truck],
] as const;

export function DesktopInventoryNavigation() {
  const pathname = usePathname();
  const inventoryActive = pathname === "/inventory" || pathname.startsWith("/inventory/");
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? inventoryActive;
  return <div className={`nav-group ${inventoryActive ? "active" : ""}`}>
    <button className="nav-link nav-group-trigger" type="button" aria-expanded={open} aria-controls="inventory-subnavigation" onClick={() => setManualOpen(!open)}><Boxes size={18} /><span>Inventory</span><ChevronDown className="nav-group-chevron" size={16} /></button>
    {open && <div className="nav-submenu" id="inventory-subnavigation">{inventoryLinks.map(([label, href, Icon]) => <Link className={pathname === href ? "active" : ""} href={href} key={href}><Icon size={14} /><span>{label}</span></Link>)}</div>}
  </div>;
}

export function MobileInventoryNavigation({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const inventoryActive = pathname === "/inventory" || pathname.startsWith("/inventory/");
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? inventoryActive;
  return <div className={`mobile-inventory-group ${inventoryActive ? "active" : ""}`}>
    <button className="mobile-inventory-trigger" type="button" aria-expanded={open} aria-controls="mobile-inventory-subnavigation" onClick={() => setManualOpen(!open)}><Boxes size={19} /><span>Inventory</span><ChevronDown size={15} /></button>
    {open && <div className="mobile-inventory-submenu" id="mobile-inventory-subnavigation">{inventoryLinks.map(([label, href, Icon]) => <Link className={pathname === href ? "active" : ""} href={href} key={href} onClick={onNavigate}><Icon size={16} /><span>{label}</span></Link>)}</div>}
  </div>;
}
