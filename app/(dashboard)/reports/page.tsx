import Form from "next/form";
import { Download, FileBarChart, Search } from "lucide-react";
import { Empty } from "@/components/empty";
import { getReferenceData, getReportSnapshot } from "@/lib/cached-data";
import { formatDateTime, parseDateRange } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireManagement } from "@/lib/session";
import { reportFilterInput } from "@/lib/validation";
import { Flash } from "@/components/flash";

export const metadata = { title: "Reports" };
const reportNames = ["Daily sales", "Monthly sales", "Sales by service", "Sales by supervisor", "Sales by payment method", "Receipt history", "Cancelled receipts", "General expenses", "Worker commissions", "Supervisor salaries", "Purchases", "Current stock", "Low-stock items", "Inventory issued", "Damaged & lost", "Movement history", "Cash summary"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement();
  const query = await searchParams;
  const parsedFilters = reportFilterInput.safeParse(query);
  const filters = parsedFilters.success ? parsedFilters.data : { type: "sales" as const, from: undefined, to: undefined, supervisorId: undefined };
  const { start, end } = parseDateRange(filters.from, filters.to);
  const references = await getReferenceData();
  const supervisors = references.supervisors;
  const selectedSupervisor = supervisors.find((row) => row.id === filters.supervisorId);
  const supervisorId = selectedSupervisor?.id;
  const report = await getReportSnapshot(start, end, supervisorId);
  const exportParams = new URLSearchParams();
  if (filters.from) exportParams.set("from", filters.from);
  if (filters.to) exportParams.set("to", filters.to);
  if (supervisorId) exportParams.set("supervisorId", supervisorId);
  const exportHref = (type: string) => `/api/reports/csv?type=${type}${exportParams.size ? `&${exportParams.toString()}` : ""}`;

  return <div className="page">
    <div className="page-head">
      <div>
        <span className="eyebrow">Decision support</span>
        <h1>{selectedSupervisor ? `${selectedSupervisor.fullName}'s report` : "Reports"}</h1>
        <p>{selectedSupervisor ? `Showing only activity assigned to @${selectedSupervisor.username ?? selectedSupervisor.fullName}.` : "Every figure is recalculated from transaction records for the selected period."}</p>
      </div>
      <a className="btn btn-primary" href={exportHref("sales")} download>
        <Download size={16} /> Export sales CSV</a>
    </div>
    {!parsedFilters.success && <Flash error="Invalid report filters were ignored." />}
    <Form action="/reports" className="card filters">
      <div className="field">
        <label>From</label>
        <input className="input" type="date" name="from" defaultValue={filters.from} />
      </div>
      <div className="field">
        <label>To</label>
        <input className="input" type="date" name="to" defaultValue={filters.to} />
      </div>
      <div className="field">
        <label>Supervisor</label>
        <select className="input" name="supervisorId" defaultValue={supervisorId ?? ""}>
          <option value="">All supervisors</option>{supervisors.map((row) => <option value={row.id} key={row.id}>{row.fullName} (@{row.username ?? "no-username"}){row.isActive ? "" : " — disabled"}</option>)}
        </select>
      </div>
      <button className="btn btn-primary">
        <Search size={15} /> Apply filters</button>
      <div className="actions">
        <a className="btn btn-ghost" href={exportHref("expenses")} download>Expenses CSV</a>
        <a className="btn btn-ghost" href={exportHref("issues")} download>Handovers CSV</a>
        <a className="btn btn-ghost" href={exportHref("movements")} download>Movements CSV</a>{!supervisorId && <>
          <a className="btn btn-ghost" href={exportHref("purchases")} download>Purchases CSV</a>
          <a className="btn btn-ghost" href={exportHref("stock")} download>Stock CSV</a>
        </>}</div>
    </Form>
    <div className="grid stats-grid section-gap">
      <Summary label="Completed sales" value={formatMoney(report.sales.total, report.currency)} note={`${report.sales.count} receipts`} />
      <Summary label="Paid expenses" value={formatMoney(report.expenses.total, report.currency)} note={`${report.expenses.count} active records`} />
      <Summary label="Received purchases" value={supervisorId ? "Not applicable" : formatMoney(report.purchases.total, report.currency)} note={supervisorId ? "Purchases are store-wide" : `${report.purchases.count} purchases · ${report.purchases.lineCount} items`} />
      <Summary label="Cash movement" value={formatMoney(report.cash, report.currency)} note={supervisorId ? "Sales − supervisor paid expenses" : "Sales − paid expenses − paid purchases"} /></div>

    <div className="grid three-grid section-gap">
      <Group title="Sales by service" rows={report.byService} currency={report.currency} />
      <Group title="Sales by supervisor" rows={report.bySupervisor} currency={report.currency} />
      <Group title="Sales by payment method" rows={report.byPayment} currency={report.currency} />
    </div>
    <div className="grid two-grid section-gap">
      <div className="card">
        <div className="card-head">
          <h2>Receipt and cancellation history</h2>
        </div>{!report.receipts.length ? <Empty /> : <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt</th>
                <th>Service</th>
                <th>Supervisor</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>{report.receipts.map((row) => <tr key={row.id}>
              <td>{formatDateTime(row.issuedAt)}</td>
              <td>#{String(row.id).padStart(6, "0")}</td>
              <td>{row.service}</td><td>{row.supervisor}</td><td>{formatMoney(row.total, report.currency)}</td><td><span className={`badge ${row.status === "COMPLETED" ? "success" : "danger"}`}>{row.status}</span></td></tr>)}</tbody></table></div>}</div><div className="card"><div className="card-head"><h2>Expenses by type</h2></div>{!report.expenseRows.length ? <Empty /> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Amount</th><th>Status</th></tr></thead><tbody>{report.expenseRows.map((row) => <tr key={row.id}><td>{formatDateTime(row.expenseDate)}</td><td>{row.type.replaceAll("_", " ")}</td><td>{row.title}</td><td>{formatMoney(row.amount, report.currency)}</td><td>{row.status}</td></tr>)}</tbody></table></div>}</div></div>
    <div className="grid two-grid section-gap"><div className="card"><div className="card-head"><h2>Current and low stock <span className="muted">(store-wide)</span></h2></div><div className="table-wrap"><table><thead><tr><th>Item</th><th>Owned</th><th>Assigned</th><th>Available</th><th>Level</th></tr></thead><tbody>{report.stock.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.owned}</td><td>{row.assigned}</td><td>{row.available}</td><td><span className={`badge ${row.low ? "warning" : "success"}`}>{row.low ? "Low" : "OK"}</span></td></tr>)}</tbody></table></div></div><div className="card"><div className="card-head"><h2>{selectedSupervisor ? `${selectedSupervisor.fullName}'s inventory movements` : "Issued, damaged, lost & movements"}</h2></div>{!report.movements.length ? <Empty message="No inventory movements in this period." /> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th>Qty</th></tr></thead><tbody>{report.movements.map((row) => <tr key={row.id}><td>{formatDateTime(row.createdAt)}</td><td>{row.item}</td><td>{row.type.replaceAll("_", " ")}</td><td>{row.quantity}</td></tr>)}</tbody></table></div>}<p className="muted" style={{ padding: "0 20px" }}>{report.issueCount} handovers in period.</p></div></div>
    <div className="card section-gap"><div className="card-head"><h2>Inventory handover reconciliation</h2></div>{!report.issueRows.length ? <Empty message="No handovers in this period." /> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Supervisor</th><th>Item</th><th>Issued</th><th>Returned</th><th>Used</th><th>Damaged</th><th>Lost</th><th>Status</th></tr></thead><tbody>{report.issueRows.flatMap((issue) => issue.items.map((line, index) => <tr key={`${issue.id}-${line.item}`}><td>{index === 0 ? formatDateTime(issue.issueDate) : ""}</td><td>{index === 0 ? issue.supervisor : ""}</td><td>{line.item}</td><td>{line.issued} {line.unit}</td><td>{line.returned}</td><td>{line.consumed}</td><td>{line.damaged}</td><td>{line.lost}</td><td>{index === 0 ? issue.status : ""}</td></tr>))}</tbody></table></div>}</div>
  </div>;
}


function Summary({ label, value, note }: { label: string; value: string; note: string }) { return <div className="card stat"><div className="stat-top">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>; }
function Group({ title, rows, currency }: { title: string; rows: { name: string; count: number; total: string }[]; currency: string }) { return <div className="card card-pad"><h2>{title}</h2>{rows.length ? rows.map((row) => <div className="checkout-row" key={row.name}><span>{row.name}<small className="muted" style={{ display: "block" }}>{row.count} receipts</small></span><strong>{formatMoney(row.total, currency)}</strong></div>) : <p className="muted">No completed sales.</p>}</div>; }
