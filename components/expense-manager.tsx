"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleDollarSign, Pencil, Save, Trash2, X } from "lucide-react";
import { deleteExpenseAction, updateExpenseAction } from "@/app/actions";

type Option = { id: string; name: string };
type Supervisor = { id: string; fullName: string; isActive: boolean };
type Expense = {
  id: string; type: "GENERAL" | "WORKER_COMMISSION" | "SUPERVISOR_SALARY"; title: string;
  expenseDate: string; categoryId: string | null; supervisorUserId: string | null; paymentMethodId: string | null;
  paymentStatus: "UNPAID" | "PAID"; amount: string; carCount: number | null; ratePerCar: string | null;
  periodStart: string | null; periodEnd: string | null; paymentReference: string | null; notes: string | null;
  commissionOverrideReason: string | null; status: "ACTIVE" | "CANCELLED";
  category: Option | null; supervisor: { id: string; fullName: string } | null;
};

export function ExpenseManager({ expense, categories, supervisors, methods }: { expense: Expense; categories: Option[]; supervisors: Supervisor[]; methods: Option[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState(expense.type);
  const titleId = `manage-expense-${expense.id}`;
  const categoryOptions = includeCurrent(categories, expense.category);
  const supervisorOptions = includeCurrent(supervisors.filter((row) => row.isActive).map(({ id, fullName }) => ({ id, name: fullName })), expense.supervisor ? { id: expense.supervisor.id, name: expense.supervisor.fullName } : null);
  return <>
    <button className="btn btn-ghost btn-compact" type="button" onClick={() => dialog.current?.showModal()}><Pencil size={14} /> Manage</button>
    <dialog className="account-dialog record-dialog" ref={dialog} aria-labelledby={titleId} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head"><span className="account-dialog-icon"><CircleDollarSign size={22} /></span><div className="account-dialog-title"><h2 id={titleId}>Manage expense</h2><p>{expense.title} · {expense.status === "ACTIVE" ? "Editable active record" : "Cancelled record"}</p></div><button className="icon-button" type="button" aria-label="Close expense editor" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        {expense.status === "ACTIVE" ? <form action={updateExpenseAction} className="account-edit-form">
          <input type="hidden" name="id" value={expense.id} />
          <div className="account-form-grid">
            <div className="field"><label htmlFor={`${expense.id}-type`}>Expense type</label><select className="input" id={`${expense.id}-type`} name="type" value={type} onChange={(event) => setType(event.target.value as Expense["type"])} required><option value="GENERAL">General expense</option><option value="WORKER_COMMISSION">Worker commission</option><option value="SUPERVISOR_SALARY">Supervisor salary</option></select></div>
            <div className="field"><label htmlFor={`${expense.id}-date`}>Date</label><input className="input" id={`${expense.id}-date`} type="date" name="expenseDate" defaultValue={expense.expenseDate.slice(0, 10)} required /></div>
            <div className="field account-field-full"><label htmlFor={`${expense.id}-title`}>Title</label><input className="input" id={`${expense.id}-title`} name="title" defaultValue={expense.title} required /></div>
            {type === "GENERAL" && <><div className="field"><label htmlFor={`${expense.id}-category`}>Category</label><select className="input" id={`${expense.id}-category`} name="categoryId" defaultValue={expense.categoryId ?? ""} required><option value="">Select category</option>{categoryOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div><MoneyField id={`${expense.id}-amount`} defaultValue={expense.amount} /></>}
            {type !== "GENERAL" && <div className="field"><label htmlFor={`${expense.id}-supervisor`}>Supervisor</label><select className="input" id={`${expense.id}-supervisor`} name="supervisorUserId" defaultValue={expense.supervisorUserId ?? ""} required><option value="">Select supervisor</option>{supervisorOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>}
            {type === "SUPERVISOR_SALARY" && <><MoneyField id={`${expense.id}-amount`} defaultValue={expense.amount} /><div className="field"><label htmlFor={`${expense.id}-period-start`}>Period start</label><input className="input" id={`${expense.id}-period-start`} type="date" name="periodStart" defaultValue={expense.periodStart?.slice(0, 10) ?? ""} /></div><div className="field"><label htmlFor={`${expense.id}-period-end`}>Period end</label><input className="input" id={`${expense.id}-period-end`} type="date" name="periodEnd" defaultValue={expense.periodEnd?.slice(0, 10) ?? ""} /></div></>}
            {type === "WORKER_COMMISSION" && <><div className="field"><label htmlFor={`${expense.id}-cars`}>Completed cars</label><input className="input" id={`${expense.id}-cars`} type="number" min="1" name="carCount" defaultValue={expense.carCount ?? ""} required /></div><div className="field"><label htmlFor={`${expense.id}-rate`}>Rate per car</label><input className="input" id={`${expense.id}-rate`} inputMode="decimal" name="ratePerCar" defaultValue={expense.ratePerCar ?? ""} required /></div><div className="field account-field-full"><label htmlFor={`${expense.id}-override`}>Override reason <span className="muted">— only if cars exceed receipts</span></label><input className="input" id={`${expense.id}-override`} name="overrideReason" defaultValue={expense.commissionOverrideReason ?? ""} /></div></>}
            <div className="field"><label htmlFor={`${expense.id}-payment-status`}>Payment status</label><select className="input" id={`${expense.id}-payment-status`} name="paymentStatus" defaultValue={expense.paymentStatus}><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option></select></div>
            <div className="field"><label htmlFor={`${expense.id}-payment-method`}>Payment method</label><select className="input" id={`${expense.id}-payment-method`} name="paymentMethodId" defaultValue={expense.paymentMethodId ?? ""}><option value="">Not specified</option>{methods.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
            <div className="field account-field-full"><label htmlFor={`${expense.id}-reference`}>Payment reference <span className="muted">— optional</span></label><input className="input" id={`${expense.id}-reference`} name="paymentReference" defaultValue={expense.paymentReference ?? ""} /></div>
            <div className="field account-field-full"><label htmlFor={`${expense.id}-notes`}>Notes <span className="muted">— optional</span></label><textarea className="input" id={`${expense.id}-notes`} name="notes" defaultValue={expense.notes ?? ""} /></div>
          </div>
          <p className="record-audit-note">Changes are recorded in the audit log.</p>
          <div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button><SaveButton /></div>
        </form> : <div className="record-locked-note">This expense is cancelled and cannot be edited. You can permanently remove it below if it was entered by mistake.</div>}
        <div className="danger-zone"><div><strong>Delete this expense</strong><p>Use only for an entry created by mistake. The deletion event remains in the audit log.</p></div><form action={deleteExpenseAction}><input type="hidden" name="id" value={expense.id} /><DeleteButton label={expense.title} /></form></div>
      </div>
    </dialog>
  </>;
}

function includeCurrent(options: Option[], current: Option | null) {
  return current && !options.some((row) => row.id === current.id) ? [current, ...options] : options;
}

function MoneyField({ id, defaultValue }: { id: string; defaultValue: string }) {
  return <div className="field"><label htmlFor={id}>Amount</label><input className="input" id={id} name="amount" inputMode="decimal" defaultValue={defaultValue} required /></div>;
}

function SaveButton() { const { pending } = useFormStatus(); return <button className="btn btn-primary" disabled={pending}><Save size={15} />{pending ? "Saving…" : "Save changes"}</button>; }
function DeleteButton({ label }: { label: string }) { const { pending } = useFormStatus(); return <button className="btn btn-danger" disabled={pending} onClick={(event) => { if (!window.confirm(`Permanently delete “${label}”? This cannot be undone.`)) event.preventDefault(); }}><Trash2 size={15} />{pending ? "Deleting…" : "Delete expense"}</button>; }
