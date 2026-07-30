"use client";

import { CircleAlert } from "lucide-react";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page">
    <div className="card card-pad" style={{ maxWidth: 600 }}>
      <span className="stat-icon" style={{ color: "#b52c2c", background: "#fff0f0" }}>
        <CircleAlert size={19} />
      </span><h1>Something went wrong</h1>
      <p className="muted">The operation could not be completed. No changes should be assumed until the page reloads successfully.</p>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  </div>;
}
