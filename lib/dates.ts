export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function endOfDate(value: string) {
  const date = new Date(`${value}T23:59:59.999`);
  return date;
}

export function parseDateRange(from?: string, to?: string) {
  const now = new Date();
  const start = from ? new Date(`${from}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  // A stable end-of-day value lets identical report requests share one cache
  // entry. Writes invalidate the report tag, so today's figures remain fresh.
  const end = to ? endOfDate(to) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}
