"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Save, ShieldCheck, UserRoundCog, X } from "lucide-react";
import { deleteSupervisorAction, updateSupervisorAction } from "@/app/actions";
import type { UserRole } from "@prisma/client";
import { ConfirmActionButton } from "@/components/confirm-action-button";

type StaffAccount = { id: string; fullName: string; username: string | null; displayUsername: string | null; role: UserRole };

export function SupervisorAccountManager({ user, canEditRole }: { user: StaffAccount; canEditRole: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = `manage-supervisor-${user.id}`;
  return <>
    <button className="btn btn-ghost" type="button" onClick={() => dialog.current?.showModal()}><Pencil size={14} /> Manage</button>
    <dialog className="account-dialog" ref={dialog} aria-labelledby={titleId} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="account-dialog-panel">
        <div className="account-dialog-head"><span className="account-dialog-icon"><UserRoundCog size={22} /></span><div className="account-dialog-title"><h2 id={titleId}>Manage staff account</h2><p>Update {user.fullName}&apos;s role, profile, and sign-in details.</p></div><button className="icon-button" type="button" aria-label="Close account editor" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
        <form action={updateSupervisorAction} className="account-edit-form">
          <input type="hidden" name="id" value={user.id} />
          <div className="account-form-grid"><div className="field"><label htmlFor={`${user.id}-fullName`}>Full name</label><input className="input" id={`${user.id}-fullName`} name="fullName" defaultValue={user.fullName} required /></div>
            <div className="field"><label htmlFor={`${user.id}-username`}>Username</label><div className="username-input"><span>@</span><input className="input" id={`${user.id}-username`} name="username" defaultValue={user.displayUsername || user.username || ""} minLength={3} autoComplete="off" required /></div></div>
            {canEditRole ? <div className="field account-field-full"><label htmlFor={`${user.id}-role`}>Access role</label><select className="input" id={`${user.id}-role`} name="role" defaultValue={user.role}><option value="SUPERVISOR">Supervisor — POS access</option><option value="MANAGER">Manager — operations access</option></select></div> : <input type="hidden" name="role" value={user.role} />}
            <div className="field account-field-full"><label htmlFor={`${user.id}-password`}>Reset password <span className="muted">— optional</span></label><input className="input" id={`${user.id}-password`} type="password" name="password" minLength={12} autoComplete="new-password" placeholder="Enter a strong password (12+ characters)" /><small>Leave empty to keep the current password. Include uppercase, lowercase, a number, and a symbol.</small></div></div>
          <div className="account-security-note"><ShieldCheck size={18} /><div><strong>Session security</strong><span>Saving signs this staff member out of every device.</span></div></div>
          <div className="account-dialog-actions"><button className="btn btn-ghost" type="button" onClick={() => dialog.current?.close()}>Cancel</button><PendingButton label="Save changes" pendingLabel="Saving…" icon={<Save size={15} />} /></div>
        </form>
        <div className="danger-zone"><div><strong>Delete this account</strong><p>Permanent deletion is available only when this staff member has no business history.</p></div><form action={deleteSupervisorAction}><input type="hidden" name="id" value={user.id} /><ConfirmActionButton triggerLabel="Delete account" title={`Delete ${user.fullName}?`} description="This staff account and its sign-in access will be permanently removed." confirmLabel="Delete account" pendingLabel="Deleting…" /></form></div>
      </div>
    </dialog>
  </>;
}

function PendingButton({ label, pendingLabel, icon }: { label: string; pendingLabel: string; icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary" disabled={pending}>{pending ? pendingLabel : <>{icon}{label}</>}</button>;
}
