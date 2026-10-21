import { describe, expect, it } from "vitest";
import { formatCountdown, parseDeadline } from "@/lib/deadline";

describe("parseDeadline", () => {
  it("converts 5:00 PM EDT on 26 Oct 2026 to 2:30 AM IST the next day", () => {
    const deadline = parseDeadline("Deadline: October 26, 2026 at 5:00 PM EDT.");
    expect(deadline.utc).toBe("2026-10-26T21:00:00.000Z");
    expect(deadline.istLabel).toContain("27 Oct 2026");
    expect(deadline.istLabel).toMatch(/2:30\s*AM/);
    expect(deadline.istLabel).toContain("IST");
  });

  it("keeps an IST clock time on the same calendar day", () => {
    const deadline = parseDeadline("Submission deadline: 15 November 2026, 11:59 PM IST.");
    expect(deadline.utc).toBe("2026-11-15T18:29:00.000Z");
    expect(deadline.istLabel).toContain("15 Nov 2026");
    expect(deadline.istLabel).toMatch(/11:59\s*PM/);
    expect(deadline.note).toMatch(/India Standard Time/);
  });

  it("prefers the date next to the deadline when a later date is also present", () => {
    const deadline = parseDeadline(`
      Workshop date: December 1, 2026 at 10:00 AM EDT.
      Deadline: October 26, 2026 at 5:00 PM EDT.
    `);
    expect(deadline.utc).toBe("2026-10-26T21:00:00.000Z");
    expect(deadline.note).toMatch(/Several dates/);
  });

  it("reads January ET as standard time", () => {
    const deadline = parseDeadline("Deadline: January 15, 2026 at 5:00 PM ET.");
    expect(deadline.utc).toBe("2026-01-15T22:00:00.000Z");
    expect(deadline.istLabel).toContain("16 Jan 2026");
    expect(deadline.istLabel).toMatch(/3:30\s*AM/);
  });

  it("reads June ET as daylight time", () => {
    const deadline = parseDeadline("Deadline: June 1, 2026 at 12:00 PM ET.");
    expect(deadline.utc).toBe("2026-06-01T16:00:00.000Z");
    expect(deadline.istLabel).toContain("1 Jun 2026");
    expect(deadline.istLabel).toMatch(/9:30\s*PM/);
  });

  it("parses ISO timestamps", () => {
    expect(parseDeadline("Due 2026-10-26T21:00:00Z").utc).toBe("2026-10-26T21:00:00.000Z");
    expect(parseDeadline("Due 2026-10-26T17:00:00-04:00").utc).toBe("2026-10-26T21:00:00.000Z");
  });

  it("does not invent a countdown when the timezone is missing", () => {
    const deadline = parseDeadline("Deadline: October 26, 2026.");
    expect(deadline.utc).toBeNull();
    expect(deadline.istLabel).toBeNull();
    expect(deadline.note).toMatch(/timezone/i);
    expect(deadline.raw).toMatch(/October 26, 2026/);
  });
});

describe("formatCountdown", () => {
  it("formats remaining and elapsed time", () => {
    const target = Date.parse("2026-10-26T21:00:00.000Z");
    expect(formatCountdown("2026-10-26T21:00:00.000Z", target - 90_000)).toBe("0d 0h 1m 30s");
    expect(formatCountdown("2026-10-26T21:00:00.000Z", target + 90_000)).toBe("Passed 0d 0h 1m 30s ago");
  });
});
