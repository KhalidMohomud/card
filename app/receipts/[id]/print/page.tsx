import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function ReceiptPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ autoprint?: string }> }) {
  const user = await requireUser(); const { id } = await params; const query = await searchParams; const receiptId = Number(id);
  if (!Number.isInteger(receiptId)) notFound();
  const [receipt, settings] = await Promise.all([
    prisma.receipt.findUnique({ where: { id: receiptId }, include: { paymentMethod: true, createdByUser: true } }),
    prisma.businessSetting.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!receipt || (user.role === "SUPERVISOR" && receipt.createdByUserId !== user.id)) notFound();
  const business = settings ?? { businessName: "SwiftWash", phone: "", address: "", currencyCode: "USD", receiptFooter: "Thank You" };
  return <main style={{ minHeight: "100vh", background: "#edf1ef", padding: "1px 0" }}>
    <div className="print-actions no-print"><Link className="btn btn-ghost" href="/receipts"><ArrowLeft size={17} /> Receipts</Link><PrintButton autoPrint={query.autoprint === "1"} /></div>
    <article className="receipt-paper">
      <h1>{business.businessName}</h1>{business.address && <div className="center">{business.address}</div>}{business.phone && <div className="center">{business.phone}</div>}
      <div className="rule" /><div className="center"><strong>RECEIPT #{String(receipt.id).padStart(6, "0")}</strong></div><div className="center">{formatDateTime(receipt.issuedAt)}</div>
      {receipt.status === "CANCELLED" && <><div className="rule" /><div className="center"><strong>*** CANCELLED ***</strong></div></>}
      <div className="rule" /><div className="row"><span>Service</span><span>{receipt.serviceNameSnapshot}</span></div><div className="row"><span>Supervisor</span><span>{receipt.createdByUser.fullName}</span></div><div className="row"><span>Payment</span><span>{receipt.paymentMethod.name}</span></div>{receipt.paymentReference && <div className="row"><span>Reference</span><span>{receipt.paymentReference}</span></div>}
      <div className="rule" /><div className="row" style={{ fontSize: 14 }}><strong>TOTAL</strong><strong>{formatMoney(receipt.servicePriceSnapshot, business.currencyCode)}</strong></div><div className="rule" />
      {receipt.printCount > 0 && <div className="center">REPRINT · COPY {receipt.printCount}</div>}<div className="center" style={{ marginTop: 10 }}>{business.receiptFooter}</div>
    </article>
  </main>;
}
