import { Empty } from "@/components/empty";
import { ExpenseCreateDialog } from "@/components/expense-create-dialog";
import { ExpenseManager } from "@/components/expense-manager";
import { Flash } from "@/components/flash";
import { getCatalogData, getExpenseLedger, getReferenceData } from "@/lib/cached-data";
import { businessDateInputValue, formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireManagement } from "@/lib/session";

export const metadata = { title: "Expenses" };
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireManagement(); const query = await searchParams; const page = Math.max(Number(query.page) || 1, 1);
  const [ledger, catalog, references] = await Promise.all([getExpenseLedger(page), getCatalogData(), getReferenceData()]);
  const expenses = ledger.rows, total = ledger.total;
  const categories = references.categories, supervisors = references.supervisors.filter((row) => row.isActive), methods = catalog.methods.filter((row) => row.isActive), settings = catalog.settings;
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Money out</span><h1>Expenses</h1><p>General costs, worker commissions, and supervisor salaries in one auditable ledger.</p></div><ExpenseCreateDialog categories={categories} supervisors={supervisors} methods={methods} today={businessDateInputValue()} /></div><Flash success={query.success} error={query.error} />
    <div className="card"><div className="card-head"><h2>Expense history</h2><span className="badge">{total}</span></div>{!expenses.length ? <Empty message="No expenses recorded yet." /> : <div className="table-wrap record-table-wrap"><table className="record-table"><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>For</th><th>Amount</th><th>Payment</th><th>Status</th><th>Manage</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td data-label="Date">{formatDateTime(expense.expenseDate)}</td><td data-label="Type"><span className="badge">{expense.type.replaceAll("_", " ")}</span></td><td data-label="Title"><strong>{expense.title}</strong>{expense.carCount && <small className="muted" style={{ display: "block" }}>{expense.carCount} cars × {formatMoney(expense.ratePerCar ?? 0, settings?.currencyCode)}</small>}</td><td data-label="For">{expense.supervisor?.fullName ?? expense.category?.name ?? "—"}</td><td data-label="Amount" className="amount">{formatMoney(expense.amount, settings?.currencyCode)}</td><td data-label="Payment">{expense.paymentStatus}</td><td data-label="Status"><span className={`badge ${expense.status === "ACTIVE" ? "success" : "danger"}`}>{expense.status}</span></td><td data-label="Manage"><ExpenseManager expense={expense} categories={categories} supervisors={references.supervisors} methods={methods} /></td></tr>)}</tbody></table></div>}</div>
  </div>;
}
