export function Flash({ success, error }: { success?: string; error?: string }) {
  return <>{success && <div className="alert alert-success">{success}</div>}{error && <div className="alert alert-error">{error}</div>}</>;
}
