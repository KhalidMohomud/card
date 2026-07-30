import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Prisma, type ReceiptStatus } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { getCatalogData } from "@/lib/cached-data";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function ReceiptPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ autoprint?: string }> }) {
  const user = await requireUser(); const { id } = await params; const query = await searchParams; const receiptId = Number(id);
  if (!Number.isInteger(receiptId)) notFound();
  const [receiptRow, catalog] = await Promise.all([
    prisma.$queryRaw<{ id: number; createdByUserId: string; issuedAt: Date; serviceNameSnapshot: string; servicePriceSnapshot: Prisma.Decimal; status: ReceiptStatus; paymentReference: string | null; printCount: number; paymentMethodName: string; supervisorName: string }[]>`
      SELECT r.id, r."createdByUserId", r."issuedAt", r."serviceNameSnapshot",
        r."servicePriceSnapshot", r.status, r."paymentReference", r."printCount",
        pm.name AS "paymentMethodName", u."fullName" AS "supervisorName"
      FROM "Receipt" r
      INNER JOIN "PaymentMethod" pm ON pm.id = r."paymentMethodId"
      INNER JOIN "user" u ON u.id = r."createdByUserId"
      WHERE r.id = ${receiptId}
      LIMIT 1
    `.then((rows) => rows[0] ?? null),
    getCatalogData(),
  ]);
  const receipt = receiptRow ? { ...receiptRow, paymentMethod: { name: receiptRow.paymentMethodName }, createdByUser: { fullName: receiptRow.supervisorName } } : null;
  if (!receipt || (user.role === "SUPERVISOR" && receipt.createdByUserId !== user.id)) notFound();
  const business = catalog.settings ?? { businessName: "SwiftWash", phone: "", email: "", address: "", currencyCode: "USD", receiptFooter: "Thank You", logoUrl: null };
  return <main className="receipt-screen">
    <div className="print-actions no-print"><Link className="btn btn-ghost" href={user.role === "SUPERVISOR" ? "/pos" : "/receipts"}><ArrowLeft size={17} /> {user.role === "SUPERVISOR" ? "Back to POS" : "Receipts"}</Link><PrintButton autoPrint={query.autoprint === "1"} /></div>
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
