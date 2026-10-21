import { sentenceAt } from "@/lib/text";
import type { DeadlineInfo } from "@/lib/types";

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_RE =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const TZ_RE =
  "utc|gmt|ist|et|edt|est|ct|cdt|cst|mt|mdt|mst|pt|pdt|pst|bst|cet|cest|jst|kst|sgt|hkt|aest|aedt|eastern(?:\\s+(?:daylight|standard))?\\s+time|india\\s+standard\\s+time|pacific\\s+time|central\\s+time|mountain\\s+time";

type Candidate = {
  index: number;
  raw: string;
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  tz: string | null;
  offsetMinutes: number | null;
  assumedEnd: boolean;
  istNote: boolean;
};

function nthSunday(year: number, monthIndex: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}

function usZoneOffsetHours(
  year: number,
  month: number,
  day: number,
  hour: number,
  zone: "ET" | "CT" | "MT" | "PT",
): number {
  const standard = { ET: -5, CT: -6, MT: -7, PT: -8 } as const;
  const startDay = nthSunday(year, 2, 2);
  const endDay = nthSunday(year, 10, 1);
  const afterStart =
    month > 2 || (month === 2 && (day > startDay || (day === startDay && hour >= 2)));
  const beforeEnd =
    month < 10 || (month === 10 && (day < endDay || (day === endDay && hour < 2)));
  return standard[zone] + (afterStart && beforeEnd ? 1 : 0);
}

function zoneOffset(
  token: string,
  year: number,
  month: number,
  day: number,
  hour: number,
): { minutes: number; istNote: boolean } | null {
  const key = token.trim().toLowerCase().replace(/\./g, "");
  if (key === "ist" || key === "india standard time") {
    return { minutes: 330, istNote: true };
  }
  const fixed: Record<string, number> = {
    utc: 0,
    gmt: 0,
    edt: -4 * 60,
    est: -5 * 60,
    "eastern daylight time": -4 * 60,
    "eastern standard time": -5 * 60,
    cdt: -5 * 60,
    cst: -6 * 60,
    "central daylight time": -5 * 60,
    "central standard time": -6 * 60,
    mdt: -6 * 60,
    mst: -7 * 60,
    pdt: -7 * 60,
    pst: -8 * 60,
    bst: 60,
    cet: 60,
    cest: 120,
    jst: 9 * 60,
    kst: 9 * 60,
    sgt: 8 * 60,
    hkt: 8 * 60,
    aest: 10 * 60,
    aedt: 11 * 60,
  };
  if (key in fixed) return { minutes: fixed[key], istNote: false };
  const floating: Record<string, "ET" | "CT" | "MT" | "PT"> = {
    et: "ET",
    eastern: "ET",
    "eastern time": "ET",
    ct: "CT",
    "central time": "CT",
    mt: "MT",
    "mountain time": "MT",
    pt: "PT",
    "pacific time": "PT",
  };
  if (key in floating) {
    return {
      minutes: usZoneOffsetHours(year, month, day, hour, floating[key]) * 60,
      istNote: false,
    };
  }
  return null;
}

function validYmd(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day;
}

function readClock(tail: string): { hour: number; minute: number; rest: string } | null {
  const match = /^\s*[(,]?\s*(?:at|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(tail);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return { hour, minute, rest: tail.slice(match[0].length) };
}

function readZone(tail: string): { token: string; restStart: number } | null {
  const match = new RegExp(`^\\s*\\)?\\s*(${TZ_RE})\\b`, "i").exec(tail);
  if (!match) return null;
  return { token: match[1], restStart: match[0].length };
}

function hintScore(text: string, index: number): number {
  const before = text.slice(Math.max(0, index - 140), index).toLowerCase();
  let score = 0;
  if (/deadline|due date|submit by|submission closes|submissions close|closes|ends\b|due\b/.test(before)) {
    score += 10;
  }
  if (/registration|opens|begins|kickoff|workshop|starts/.test(before)) score -= 6;
  return score;
}

function pushCandidate(list: Candidate[], text: string, candidate: Candidate) {
  const duplicate = list.some(
    (item) => Math.abs(item.index - candidate.index) < 4 && item.year === candidate.year && item.month === candidate.month && item.day === candidate.day,
  );
  if (!duplicate) list.push(candidate);
}

function fromParts(
  text: string,
  index: number,
  endOfDate: number,
  year: number,
  month: number,
  day: number,
  preset?: { hour: number | null; minute: number | null; offsetMinutes: number | null },
): Candidate | null {
  if (!validYmd(year, month, day)) return null;
  const tail = text.slice(endOfDate, endOfDate + 48);
  let hour = preset?.hour ?? null;
  let minute = preset?.minute ?? null;
  let offsetMinutes = preset?.offsetMinutes ?? null;
  let tz: string | null = null;
  let cursor = tail;
  let consumed = 0;
  if (hour == null) {
    const clock = readClock(tail);
    if (clock) {
      hour = clock.hour;
      minute = clock.minute;
      cursor = clock.rest;
      consumed = tail.length - clock.rest.length;
    }
  }
  if (offsetMinutes == null) {
    const zone = readZone(cursor);
    if (zone) {
      tz = zone.token;
      const resolved = zoneOffset(zone.token, year, month, day, hour ?? 12);
      if (resolved) offsetMinutes = resolved.minutes;
      consumed += zone.restStart;
    }
  }
  const raw = text
    .slice(index, endOfDate + consumed)
    .replace(/\s+/g, " ")
    .trim();
  const istNote =
    tz != null &&
    (tz.toLowerCase() === "ist" || tz.toLowerCase() === "india standard time");
  return {
    index,
    raw,
    year,
    month,
    day,
    hour,
    minute,
    tz,
    offsetMinutes,
    assumedEnd: false,
    istNote,
  };
}

function collect(text: string): Candidate[] {
  const found: Candidate[] = [];
  const iso =
    /\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?/gi;
  let match: RegExpExecArray | null;
  while ((match = iso.exec(text))) {
    const offset = match[6] ? parseIsoOffset(match[6]) : null;
    const candidate = fromParts(
      text,
      match.index,
      match.index + match[0].length,
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      {
        hour: match[4] ? Number(match[4]) : null,
        minute: match[5] ? Number(match[5]) : null,
        offsetMinutes: offset,
      },
    );
    if (candidate) pushCandidate(found, text, candidate);
  }

  const monthFirst = new RegExp(
    `\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`,
    "gi",
  );
  while ((match = monthFirst.exec(text))) {
    const month = MONTHS[match[1].toLowerCase()];
    const candidate = fromParts(
      text,
      match.index,
      match.index + match[0].length,
      Number(match[3]),
      month,
      Number(match[2]),
    );
    if (candidate) pushCandidate(found, text, candidate);
  }

  const dayFirst = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE}),?\\s+(\\d{4})\\b`,
    "gi",
  );
  while ((match = dayFirst.exec(text))) {
    const month = MONTHS[match[2].toLowerCase()];
    const candidate = fromParts(
      text,
      match.index,
      match.index + match[0].length,
      Number(match[3]),
      month,
      Number(match[1]),
    );
    if (candidate) pushCandidate(found, text, candidate);
  }
  return found;
}

function parseIsoOffset(token: string): number | null {
  if (token === "Z" || token === "z") return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(token);
  if (!match) return null;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

function toUtc(candidate: Candidate): { iso: string | null; note: string | null } {
  const notes: string[] = [];
  if (candidate.istNote) notes.push("IST is read as India Standard Time (UTC+5:30).");
  if (candidate.offsetMinutes == null) {
    notes.push("No timezone was given, so the countdown stays off.");
    return { iso: null, note: notes.join(" ") };
  }
  let hour = candidate.hour;
  let minute = candidate.minute ?? 0;
  if (hour == null) {
    hour = 23;
    minute = 59;
    notes.push("No clock time was given. Using 11:59 PM in the stated zone.");
  }
  const utcMs =
    Date.UTC(candidate.year, candidate.month, candidate.day, hour, minute) -
    candidate.offsetMinutes * 60_000;
  return { iso: new Date(utcMs).toISOString(), note: notes.length ? notes.join(" ") : null };
}

export function formatIst(utcIso: string): string {
  const date = new Date(utcIso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = String(Number(pick("hour")));
  const minute = pick("minute").padStart(2, "0");
  const period = pick("dayPeriod").replace(/\./g, "").toUpperCase();
  return `${pick("weekday")}, ${pick("day")} ${pick("month")} ${pick("year")}, ${hour}:${minute} ${period} IST`;
}

export function formatCountdown(utcIso: string, nowMs: number): string {
  const target = Date.parse(utcIso);
  if (Number.isNaN(target)) return "No countdown";
  const diff = target - nowMs;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const mins = Math.floor((abs % 3_600_000) / 60_000);
  const secs = Math.floor((abs % 60_000) / 1000);
  const body = `${days}d ${hours}h ${mins}m ${secs}s`;
  return diff >= 0 ? body : `Passed ${body} ago`;
}

export function parseDeadline(text: string): DeadlineInfo {
  const candidates = collect(text);
  if (candidates.length === 0) {
    return { raw: null, utc: null, istLabel: null, evidence: null, note: null };
  }
  const ranked = candidates
    .map((candidate) => {
      const utc = toUtc(candidate);
      return {
        candidate,
        score: hintScore(text, candidate.index),
        utc: utc.iso,
        note: utc.note,
        utcMs: utc.iso ? Date.parse(utc.iso) : null,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aHas = a.utc ? 1 : 0;
      const bHas = b.utc ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      return (b.utcMs ?? 0) - (a.utcMs ?? 0);
    });
  const best = ranked[0];
  const notes = [best.note].filter(Boolean) as string[];
  if (candidates.length > 1) {
    notes.push("Several dates showed up. This one sat next to the deadline.");
  }
  return {
    raw: best.candidate.raw,
    utc: best.utc,
    istLabel: best.utc ? formatIst(best.utc) : null,
    evidence: sentenceAt(text, best.candidate.index),
    note: notes.length ? notes.join(" ") : null,
  };
}
