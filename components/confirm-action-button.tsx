"use client";

import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ConfirmActionButtonProps = {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  tone?: "danger" | "success";
  triggerClassName?: string;
  triggerIcon?: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  warning?: string;
};

export function ConfirmActionButton({
  triggerLabel,
  title,
  description,
  confirmLabel,
  pendingLabel,
  tone = "danger",
  triggerClassName,
  triggerIcon,
  disabled = false,
  disabledReason,
  warning,
}: ConfirmActionButtonProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { pending } = useFormStatus();
  const isDanger = tone === "danger";
  const Icon = isDanger ? AlertTriangle : CheckCircle2;
  return <>
    <button className={triggerClassName ?? (isDanger ? "btn btn-danger" : "btn btn-soft")} type="button" disabled={disabled || pending} title={disabled ? disabledReason : undefined} onClick={() => dialog.current?.showModal()}>{triggerIcon ?? (isDanger ? <Trash2 size={15} /> : <CheckCircle2 size={15} />)}{pending ? pendingLabel : triggerLabel}</button>
    <dialog className={`confirm-dialog confirm-dialog-${tone}`} ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onClick={(event) => { if (event.target === dialog.current) dialog.current.close(); }}>
      <div className="confirm-dialog-panel">
        <button className="confirm-dialog-close" type="button" aria-label="Close confirmation" onClick={() => dialog.current?.close()}><X size={18} /></button>
        <span className="confirm-dialog-icon"><Icon size={25} /></span>
        <span className="confirm-dialog-eyebrow">{isDanger ? "Permanent action" : "Confirm action"}</span>
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="confirm-dialog-warning"><Icon size={17} /><span>{warning ?? (isDanger ? "This action cannot be undone." : "Review the details before you continue.")}</span></div>
        <div className="confirm-dialog-actions"><button className="btn btn-ghost" type="button" disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button><button className={isDanger ? "btn btn-danger confirm-danger-button" : "btn btn-primary"} type="submit" disabled={pending}>{isDanger ? <Trash2 size={15} /> : <CheckCircle2 size={15} />}{pending ? pendingLabel : confirmLabel}</button></div>
      </div>
    </dialog>
  </>;
}
