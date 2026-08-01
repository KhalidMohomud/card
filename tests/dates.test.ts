import { describe, expect, it } from "vitest";
import { businessDateEnd, businessDateInputValue, businessDateStart, getBusinessPeriods } from "@/lib/dates";

const MOGADISHU = "Africa/Mogadishu";

describe("business reporting dates", () => {
  it("converts a Mogadishu calendar day to exact UTC boundaries", () => {
    expect(businessDateStart("2026-08-01", MOGADISHU).toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(businessDateEnd("2026-08-01", MOGADISHU).toISOString()).toBe("2026-08-01T20:59:59.999Z");
  });

  it("creates bounded today and current-month periods", () => {
    const period = getBusinessPeriods(new Date("2026-08-01T07:08:31.993Z"), MOGADISHU);
    expect(period.todayStart.toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(period.tomorrowStart.toISOString()).toBe("2026-08-01T21:00:00.000Z");
    expect(period.monthStart.toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(period.nextMonthStart.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(period.monthLabel).toBe("August 2026");
  });

  it("uses the business date for form defaults near UTC midnight", () => {
    expect(businessDateInputValue(new Date("2026-07-31T22:30:00.000Z"), MOGADISHU)).toBe("2026-08-01");
  });

  it("rejects impossible calendar dates", () => {
    expect(() => businessDateStart("2026-02-30", MOGADISHU)).toThrow("INVALID_DATE");
  });
});
