"use client";

import { CircleDollarSign, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createExpenseAction } from "@/app/actions";

type Option = { id: string; name: string };
type Supervisor = { id: string; fullName: string };
type ExpenseType = "GENERAL" | "WORKER_COMMISSION" | "SUPERVISOR_SALARY";

export function ExpenseCreateDialog({ categories, supervisors, methods, today }: { categories: Option[]; supervisors: Supervisor[]; methods: Option[]; today: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<ExpenseType>("GENERAL");

  function closeAndReset() {
    dialog.current?.close();
    form.current?.reset();
    setType("GENERAL");
  }

  return <>
    <button className="btn btn-primary expense-create-trigger" type="button" onClick={() => dialog.current?.showModal()}>
      <Plus size={17} /> Record expense
    </button>
    <dialog className="account-dialog record-dialog" ref={dialog} aria-labelledby="create-expense-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head">
          <span className="account-dialog-icon"><CircleDollarSign size={22} /></span>
          <div className="account-dialog-title"><h2 id="create-expense-title">Record expense</h2><p>Enter only the details required for the selected expense type.</p></div>
          <button className="icon-button" type="button" aria-label="Close expense creator" onClick={() => dialog.current?.close()}><X size={19} /></button>
        </div>
        <form action={createExpenseAction} className="account-edit-form" ref={form}>
          <div className="account-form-grid">
            <div className="field"><label htmlFor="new-expense-type">Expense type</label><select className="input" id="new-expense-type" name="type" value={type} onChange={(event) => setType(event.target.value as ExpenseType)} required><option value="GENERAL">General expense</option><option value="WORKER_COMMISSION">Worker commission</option><option value="SUPERVISOR_SALARY">Supervisor salary</option></select></div>
            <div className="field"><label htmlFor="new-expense-date">Date</label><input className="input" id="new-expense-date" type="date" name="expenseDate" defaultValue={today} required /></div>
            <div className="field account-field-full"><label htmlFor="new-expense-title-field">Title</label><input className="input" id="new-expense-title-field" name="title" required /></div>
            {type === "GENERAL" && <><div className="field"><label htmlFor="new-expense-category">Category</label><select className="input" id="new-expense-category" name="categoryId" required><option value="">Select category</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div><AmountField id="new-expense-amount" /></>}
            {type !== "GENERAL" && <div className="field"><label htmlFor="new-expense-supervisor">Supervisor</label><select className="input" id="new-expense-supervisor" name="supervisorUserId" required><option value="">Select supervisor</option>{supervisors.map((row) => <option key={row.id} value={row.id}>{row.fullName}</option>)}</select></div>}
            {type === "SUPERVISOR_SALARY" && <><AmountField id="new-expense-amount" /><div className="field"><label htmlFor="new-expense-period-start">Period start</label><input className="input" id="new-expense-period-start" type="date" name="periodStart" /></div><div className="field"><label htmlFor="new-expense-period-end">Period end</label><input className="input" id="new-expense-period-end" type="date" name="periodEnd" /></div></>}
            {type === "WORKER_COMMISSION" && <><div className="field"><label htmlFor="new-expense-cars">Completed cars</label><input className="input" id="new-expense-cars" name="carCount" type="number" min="1" required /></div><div className="field"><label htmlFor="new-expense-rate">Rate per car</label><input className="input" id="new-expense-rate" name="ratePerCar" inputMode="decimal" placeholder="0.00" required /></div><div className="field account-field-full"><label htmlFor="new-expense-override">Override reason <span className="muted">— only if cars exceed receipts</span></label><input className="input" id="new-expense-override" name="overrideReason" /></div></>}
            <div className="field"><label htmlFor="new-expense-payment-status">Payment status</label><select className="input" id="new-expense-payment-status" name="paymentStatus" defaultValue="PAID"><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option></select></div>
            <div className="field"><label htmlFor="new-expense-payment-method">Payment method <span className="muted">— optional</span></label><select className="input" id="new-expense-payment-method" name="paymentMethodId"><option value="">Not specified</option>{methods.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
            <div className="field account-field-full"><label htmlFor="new-expense-reference">Payment reference <span className="muted">— optional</span></label><input className="input" id="new-expense-reference" name="paymentReference" /></div>
            <div className="field account-field-full"><label htmlFor="new-expense-notes">Notes <span className="muted">— optional</span></label><textarea className="input" id="new-expense-notes" name="notes" /></div>
          </div>
          <div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button><RecordExpenseButton /></div>
        </form>
      </div>
    </dialog>
  </>;
}

function AmountField({ id }: { id: string }) {
  return <div className="field"><label htmlFor={id}>Amount</label><input className="input" id={id} name="amount" inputMode="decimal" placeholder="0.00" required /></div>;
}

function RecordExpenseButton() {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" disabled={pending}><Plus size={16} /> {pending ? "Recording…" : "Record expense"}</button>;
}
