"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Save, ShieldCheck, Trash2, UserRoundCog, X } from "lucide-react";
import { deleteSupervisorAction, updateSupervisorAction } from "@/app/actions";

type Supervisor = { id: string; fullName: string; username: string | null; displayUsername: string | null };

export function SupervisorAccountManager({ user }: { user: Supervisor }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = `manage-supervisor-${user.id}`;
  return <>
    <button className="btn btn-ghost" type="button" onClick={() => dialog.current?.showModal()}><Pencil size={14} /> Manage</button>
    <dialog className="account-dialog" ref={dialog} aria-labelledby={titleId} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head"><span className="account-dialog-icon"><UserRoundCog size={22} /></span><div className="account-dialog-title"><h2 id={titleId}>Manage supervisor</h2><p>Update {user.fullName}&apos;s profile and sign-in details.</p></div><button className="icon-button" type="button" aria-label="Close account editor" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <form action={updateSupervisorAction} className="account-edit-form">
          <input type="hidden" name="id" value={user.id} />
          <div className="account-form-grid"><div className="field"><label htmlFor={`${user.id}-fullName`}>Full name</label><input className="input" id={`${user.id}-fullName`} name="fullName" defaultValue={user.fullName} required /></div>
            <div className="field"><label htmlFor={`${user.id}-username`}>Username</label><div className="username-input"><span>@</span><input className="input" id={`${user.id}-username`} name="username" defaultValue={user.displayUsername || user.username || ""} minLength={3} autoComplete="off" required /></div></div>
            <div className="field account-field-full"><label htmlFor={`${user.id}-password`}>Reset password <span className="muted">— optional</span></label><input className="input" id={`${user.id}-password`} type="password" name="password" minLength={12} autoComplete="new-password" placeholder="Enter a strong password (12+ characters)" /><small>Leave empty to keep the current password. Include uppercase, lowercase, a number, and a symbol.</small></div></div>
          <div className="account-security-note"><ShieldCheck size={18} /><div><strong>Session security</strong><span>Saving signs this supervisor out of every device.</span></div></div>
          <div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button><PendingButton label="Save changes" pendingLabel="Saving…" icon={<Save size={15} />} /></div>
        </form>
        <div className="danger-zone"><div><strong>Delete this account</strong><p>Permanent deletion is available only when the supervisor has no business history.</p></div><form action={deleteSupervisorAction}><input type="hidden" name="id" value={user.id} /><PendingDeleteButton name={user.fullName} /></form></div>
      </div>
    </dialog>
  </>;
}

function PendingButton({ label, pendingLabel, icon }: { label: string; pendingLabel: string; icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" disabled={pending}>{pending ? pendingLabel : <>{icon}{label}</>}</button>;
}

function PendingDeleteButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-danger" disabled={pending} onClick={(event) => { if (!window.confirm(`Permanently delete ${name}? This cannot be undone.`)) event.preventDefault(); }}><Trash2 size={15} /> {pending ? "Deleting…" : "Delete account"}</button>;
}
