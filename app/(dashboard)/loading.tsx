export default function Loading() {
  return <div className="page"><div className="page-head"><div><span className="eyebrow">Loading</span><h1>Preparing your workspace…</h1><p>Fetching live business records securely.</p></div></div><div className="grid stats-grid">{[1, 2, 3, 4].map((item) => <div className="card stat" style={{ minHeight: 130, opacity: .55 }} key={item} />)}</div></div>;
}
