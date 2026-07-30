export default function Loading() {
  return <div className="page">
    <div className="card loading-status" role="status" aria-live="polite" aria-busy="true">
      <span className="loading-spinner" aria-hidden="true" />
      <div>
        <strong>Loading this page…</strong>
        <p>Current information will appear here.</p>
      </div>
    </div>
  </div>;
}
