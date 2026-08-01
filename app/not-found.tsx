import Link from "next/link";
import { connection } from "next/server";

export default async function NotFound() {
    // Nonce-based CSP values are request-specific, so the global 404 must not
    // be emitted from a nonce-less prerendered artifact.
    await connection();
    return <main className="login-panel" style={{ minHeight: "100vh" }}>
        <div className="login-card">
            <span className="eyebrow">404</span>
            <h2>Page not found</h2>
            <p>The record may not exist, or you may not have permission to view it.</p>
            <Link className="btn btn-primary" href="/dashboard">Back to dashboard</Link>
        </div>
    </main>;
}
