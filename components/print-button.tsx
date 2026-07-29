"use client";
import { useEffect } from "react";
import { Printer } from "lucide-react";
export function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => { if (autoPrint) window.print(); }, [autoPrint]);
  return <button className="btn btn-primary" onClick={() => window.print()}><Printer size={17} /> Print receipt</button>;
}
