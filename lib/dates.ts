const DEFAULT_BUSINESS_TIME_ZONE = "Africa/Mogadishu";

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const BUSINESS_TIME_ZONE = isValidTimeZone(process.env.BUSINESS_TIME_ZONE ?? "")
  ? process.env.BUSINESS_TIME_ZONE!
  : DEFAULT_BUSINESS_TIME_ZONE;

type CalendarDate = { year: number; month: number; day: number };
type ZonedParts = CalendarDate & { hour: number; minute: number; second: number };

function dateParts(value: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: number("year"), month: number("month"), day: number("day"), hour: number("hour"), minute: number("minute"), second: number("second") };
}

function offsetMilliseconds(value: Date, timeZone: string) {
  const parts = dateParts(value, timeZone);
  const displayedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return displayedAsUtc - Math.floor(value.getTime() / 1000) * 1000;
}

function zonedDateTimeToUtc(parts: ZonedParts, timeZone: string) {
  const intended = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let candidate = new Date(intended);
  let offset = offsetMilliseconds(candidate, timeZone);
  candidate = new Date(intended - offset);
  const refinedOffset = offsetMilliseconds(candidate, timeZone);
  if (refinedOffset !== offset) {
    offset = refinedOffset;
    candidate = new Date(intended - offset);
  }
  return candidate;
}

function parseCalendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("INVALID_DATE");
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (check.getUTCFullYear() !== parts.year || check.getUTCMonth() + 1 !== parts.month || check.getUTCDate() !== parts.day) throw new Error("INVALID_DATE");
  return parts;
}

function addCalendarDays(parts: CalendarDate, amount: number): CalendarDate {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function atStartOfDay(parts: CalendarDate, timeZone: string) {
  return zonedDateTimeToUtc({ ...parts, hour: 0, minute: 0, second: 0 }, timeZone);
}

export function businessDateStart(value: string, timeZone = BUSINESS_TIME_ZONE) {
  return atStartOfDay(parseCalendarDate(value), timeZone);
}

export function businessDateEnd(value: string, timeZone = BUSINESS_TIME_ZONE) {
  return new Date(atStartOfDay(addCalendarDays(parseCalendarDate(value), 1), timeZone).getTime() - 1);
}

export function businessDateInputValue(now = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = dateParts(now, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getBusinessPeriods(now = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const today = dateParts(now, timeZone);
  const todayDate = { year: today.year, month: today.month, day: today.day };
  const nextMonthDate = today.month === 12
    ? { year: today.year + 1, month: 1, day: 1 }
    : { year: today.year, month: today.month + 1, day: 1 };
  const todayStart = atStartOfDay(todayDate, timeZone);
  const tomorrowStart = atStartOfDay(addCalendarDays(todayDate, 1), timeZone);
  const monthStart = atStartOfDay({ year: today.year, month: today.month, day: 1 }, timeZone);
  const nextMonthStart = atStartOfDay(nextMonthDate, timeZone);
  const dateFormat = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" });
  const monthFormat = new Intl.DateTimeFormat("en-GB", { timeZone, month: "long", year: "numeric" });
  return {
    timeZone,
    todayStart,
    tomorrowStart,
    monthStart,
    nextMonthStart,
    todayLabel: dateFormat.format(now),
    monthLabel: monthFormat.format(now),
    monthRangeLabel: `${dateFormat.format(monthStart)} – ${dateFormat.format(new Date(nextMonthStart.getTime() - 1))}`,
  };
}

export function startOfToday() {
  return getBusinessPeriods().todayStart;
}

export function startOfMonth() {
  return getBusinessPeriods().monthStart;
}

export function endOfDate(value: string) {
  return businessDateEnd(value);
}

export function parseDateRange(from?: string, to?: string) {
  const periods = getBusinessPeriods();
  const start = from ? businessDateStart(from) : periods.monthStart;
  // A stable end-of-day value lets identical report requests share one cache
  // entry. Writes invalidate the report tag, so today's figures remain fresh.
  const end = to ? businessDateEnd(to) : new Date(periods.tomorrowStart.getTime() - 1);
  if (start > end) throw new Error("INVALID_DATE_RANGE");
  return { start, end };
}

export function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof value === "string" ? new Date(value) : value);
}
