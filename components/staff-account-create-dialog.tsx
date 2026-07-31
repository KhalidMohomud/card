"use client";

import type { UserRole } from "@prisma/client";
import { Plus, UserPlus, X } from "lucide-react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createSupervisorAction } from "@/app/actions";

export function StaffAccountCreateDialog({ operatorRole }: { operatorRole: UserRole }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  function closeAndReset() {
    dialog.current?.close();
    form.current?.reset();
  }

  return <>
    <button className="btn btn-primary staff-create-trigger" type="button" onClick={() => dialog.current?.showModal()}>
      <UserPlus size={17} /> Add staff member
    </button>
    <dialog className="account-dialog" ref={dialog} aria-labelledby="create-staff-title" onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head">
          <span className="account-dialog-icon"><UserPlus size={22} /></span>
          <div className="account-dialog-title">
            <h2 id="create-staff-title">Create staff account</h2>
            <p>Set the staff member&apos;s access level and secure sign-in details.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close account creator" onClick={() => dialog.current?.close()}><X size={19} /></button>
        </div>
        <form action={createSupervisorAction} className="account-edit-form" ref={form}>
          <div className="account-form-grid">
            {operatorRole === "ADMIN" ? <div className="field account-field-full">
              <label htmlFor="new-staff-role">Access role</label>
              <select className="input" id="new-staff-role" name="role" defaultValue="SUPERVISOR" required>
                <option value="SUPERVISOR">Supervisor — POS access</option>
                <option value="MANAGER">Manager — operations access</option>
              </select>
            </div> : <input type="hidden" name="role" value="SUPERVISOR" />}
            <div className="field">
              <label htmlFor="new-staff-name">Full name</label>
              <input className="input" id="new-staff-name" name="fullName" maxLength={120} autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="new-staff-username">Username</label>
              <div className="username-input"><span>@</span><input className="input" id="new-staff-username" name="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9_.]+" title="Use only letters, numbers, dots, and underscores" autoCapitalize="none" spellCheck={false} autoComplete="off" required /></div>
            </div>
            <div className="field account-field-full">
              <label htmlFor="new-staff-password">Temporary password</label>
              <input className="input" id="new-staff-password" type="password" name="password" minLength={12} maxLength={128} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,128}" title="Use 12+ characters with uppercase, lowercase, a number, and a symbol" autoComplete="new-password" required />
              <small>Use 12+ characters with uppercase, lowercase, a number, and a symbol.</small>
            </div>
          </div>
          <div className="account-dialog-actions">
            <button className="btn btn-ghost" type="button" onClick={closeAndReset}>Cancel</button>
            <PendingCreateButton />
          </div>
        </form>
      </div>
    </dialog>
  </>;
}

function PendingCreateButton() {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" disabled={pending}><Plus size={16} /> {pending ? "Creating…" : "Create account"}</button>;
}
