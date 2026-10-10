// 시간 규칙: 저장은 UTC, 하루의 경계와 표시는 Asia/Seoul. 종일 일정은 날짜로 다룬다.

import { DateTime } from "luxon";
import { ApiError } from "../errors.js";

export const ZONE = "Asia/Seoul";

/**
 * 일정의 시간. 종일 일정의 endDate는 마지막 날(포함)이다.
 * DB에는 종일 일정을 서울 0시 기준 [시작일 0시, 마지막 날 다음 날 0시)로 저장한다.
 */
export type EventTimes =
  | { allDay: true; startDate: string; endDate: string }
  | { allDay: false; startAt: Date; endAt: Date };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_PATTERN = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

export function isDateString(value: string): boolean {
  return DATE_PATTERN.test(value) && DateTime.fromISO(value, { zone: ZONE }).isValid;
}

/** 시간대가 붙은 ISO 시각만 받는다. 아니면 null. */
export function parseDateTime(value: string): Date | null {
  if (!OFFSET_PATTERN.test(value)) {
    return null;
  }
  const parsed = DateTime.fromISO(value, { setZone: true });
  return parsed.isValid ? parsed.toJSDate() : null;
}

/** 서울 기준 그 날짜의 0시 */
export function startOfDay(date: string): Date {
  return DateTime.fromISO(date, { zone: ZONE }).startOf("day").toJSDate();
}

export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: ZONE }).plus({ days }).toISODate()!;
}

export function addMonths(date: string, months: number): string {
  return DateTime.fromISO(date, { zone: ZONE }).plus({ months }).toISODate()!;
}

/** 그 시각의 서울 날짜 */
export function toDateString(at: Date): string {
  return DateTime.fromJSDate(at, { zone: ZONE }).toISODate()!;
}

/** 서울 오프셋이 붙은 ISO 시각 (예: 2026-10-21T15:00:00+09:00) */
export function toSeoulIso(at: Date): string {
  return DateTime.fromJSDate(at, { zone: ZONE }).toISO({ suppressMilliseconds: true })!;
}

export function todayInSeoul(now: Date = new Date()): string {
  return toDateString(now);
}

/** 날짜 기간(양 끝 포함)을 [시작 시각, 끝 시각)으로 바꾼다. */
export function dateRange(from: string, to: string): { start: Date; end: Date } {
  return { start: startOfDay(from), end: startOfDay(addDays(to, 1)) };
}

/** API 입력(문자열)을 EventTimes로 바꾼다. 틀리면 400 VALIDATION_ERROR. */
export function parseEventTimes(allDay: boolean, start: string, end: string): EventTimes {
  if (allDay) {
    if (!isDateString(start) || !isDateString(end)) {
      throw invalid("종일 일정의 start·end는 YYYY-MM-DD 형식이어야 합니다.");
    }
    if (end < start) {
      throw invalid("end가 start보다 빠릅니다.");
    }
    return { allDay: true, startDate: start, endDate: end };
  }
  const startAt = parseDateTime(start);
  const endAt = parseDateTime(end);
  if (!startAt || !endAt) {
    throw invalid(
      "start·end는 시간대가 있는 ISO 시각이어야 합니다 (예: 2026-10-21T15:00:00+09:00).",
    );
  }
  if (endAt < startAt) {
    throw invalid("end가 start보다 빠릅니다.");
  }
  return { allDay: false, startAt, endAt };
}

export function toStorage(times: EventTimes): { allDay: boolean; startAt: Date; endAt: Date } {
  if (times.allDay) {
    return {
      allDay: true,
      startAt: startOfDay(times.startDate),
      endAt: startOfDay(addDays(times.endDate, 1)),
    };
  }
  return { allDay: false, startAt: times.startAt, endAt: times.endAt };
}

export function fromStorage(row: { allDay: boolean; startAt: Date; endAt: Date }): EventTimes {
  if (row.allDay) {
    const startDate = toDateString(row.startAt);
    const lastDay = addDays(toDateString(row.endAt), -1);
    return { allDay: true, startDate, endDate: lastDay < startDate ? startDate : lastDay };
  }
  return { allDay: false, startAt: row.startAt, endAt: row.endAt };
}

/** API 응답용 start·end 문자열 */
export function formatEventTimes(times: EventTimes): { start: string; end: string } {
  return times.allDay
    ? { start: times.startDate, end: times.endDate }
    : { start: toSeoulIso(times.startAt), end: toSeoulIso(times.endAt) };
}

function invalid(message: string): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message);
}
