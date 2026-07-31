"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

export function Flash({ success, error }: { success?: string; error?: string }) {
  const message = error || success;
  const isError = Boolean(error);
  const [visible, setVisible] = useState(Boolean(message));
  const seenUrl = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNotification = useCallback(() => {
    setVisible(false);
    if (timer.current) clearTimeout(timer.current);
    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    url.searchParams.delete("error");
    const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
    seenUrl.current = new URL(cleanUrl, window.location.origin).href;
    window.history.replaceState(window.history.state, "", cleanUrl);
  }, []);

  useEffect(() => {
    if (!message || seenUrl.current === window.location.href) return;
    seenUrl.current = window.location.href;
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(clearNotification, isError ? 8000 : 5000);
  }, [clearNotification, isError, message]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!message || !visible) return null;

  return <div className="toast-region" aria-live={isError ? "assertive" : "polite"} aria-atomic="true">
    <div className={`toast ${isError ? "toast-error" : "toast-success"}`} role={isError ? "alert" : "status"}>
      <span className="toast-icon">{isError ? <CircleAlert size={21} /> : <CircleCheck size={21} />}</span>
      <div className="toast-content"><strong>{isError ? "Action could not be completed" : "Success"}</strong><span>{message}</span></div>
      <button className="toast-close" type="button" aria-label="Dismiss notification" onClick={clearNotification}><X size={17} /></button>
      <span className="toast-progress" style={{ animationDuration: `${isError ? 8000 : 5000}ms` }} />
    </div>
  </div>;
}
