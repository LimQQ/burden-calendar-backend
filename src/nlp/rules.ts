// 규칙 기반 자연어 일정 해석. 확신할 수 없는 값은 채우지 않는다(CLAUDE.md 규칙 3).
// 범위: docs/api-draft.md '자연어 입력'의 '규칙 기반 파서가 처리할 범위'

import { DateTime } from "luxon";
import { ZONE } from "../events/time.js";
import type { DraftParts, ParseContext } from "./types.js";

export interface RuleParse {
  parts: DraftParts;
  assumptions: string[];
}

type Take = (pattern: RegExp) => RegExpExecArray | null;

/** 0 = 월요일 (Luxon weekday 1과 맞춘다) */
const WEEKDAYS = "월화수목금토일";
const RELATIVE_DAYS = ["오늘", "내일", "모레", "글피"];
const PERIOD = "(오전|오후|아침|낮|저녁|밤|새벽)";
/** 시각 하나: 기간(오전·오후…)?, 시, (:분 | 시 (반 | N분)?) — '3시간'은 시각이 아니다. */
const TIME = `${PERIOD}?\\s*(\\d{1,2})(?:\\s*:\\s*(\\d{2})|\\s*시(?!간)(?:\\s*(반)|\\s*(\\d{1,2})\\s*분)?)`;
const MONTH_RELATIVE = /(다다음\s*달|다음\s*달|담달|이번\s*달|첫째|둘째|셋째|넷째|마지막)\s*주?/;
/** 제목에서 버리는 조사·연결어 */
const PARTICLES = new Set(["에", "에서", "까지", "부터", "쯤", "에는", "정도"]);

export function parseWithRules(text: string, ctx: ParseContext): RuleParse {
  const assumptions: string[] = [];
  const today = DateTime.fromISO(ctx.today, { zone: ZONE });
  let rest = ` ${text.replace(/\s+/g, " ").trim()} `;

  /** 처음 맞는 부분을 꺼내고 그 자리는 공백으로 바꾼다. */
  const take: Take = (pattern) => {
    const match = pattern.exec(rest);
    if (match) {
      rest = `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`;
    }
    return match;
  };

  const category = takeCategory(take, ctx.categories, () => rest);
  const allDay = take(/(?:하루\s*)?종일/) !== null;
  const date = takeDate(take, () => rest, today, assumptions);
  const { startTime, endTime } = takeTimes(take, ctx, assumptions);
  const location = takeLocation(take);
  // 시간 범위의 '까지'는 위에서 이미 빠졌다. 남은 '까지'는 마감이다(예: 수요일까지).
  const isDeadline = /까지/.test(rest);
  const title = rest
    .split(" ")
    .filter((word) => word && !PARTICLES.has(word))
    .join(" ");

  return {
    parts: {
      category,
      title: title || null,
      date,
      startTime,
      endTime,
      location,
      allDay,
      isDeadline,
      type: null,
    },
    assumptions,
  };
}

/** [ ] 안의 글자, 없으면 사용자가 가진 카테고리 이름(긴 것부터) */
function takeCategory(take: Take, categories: string[], current: () => string): string | null {
  const bracket = take(/\[([^\]]*)\]/);
  const fromBracket = bracket?.[1]?.trim();
  if (fromBracket) {
    return fromBracket;
  }
  for (const name of [...categories].sort((a, b) => b.length - a.length)) {
    if (current().toLowerCase().includes(name.toLowerCase())) {
      take(new RegExp(escapeRegExp(name), "i"));
      return name;
    }
  }
  return null;
}

function takeDate(
  take: Take,
  current: () => string,
  today: DateTime,
  assumptions: string[],
): string | null {
  const full = take(/(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})/);
  if (full) {
    return isoDate(DateTime.fromObject(ymd(full[1], full[2], full[3]), { zone: ZONE }));
  }

  const monthDay =
    take(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) ??
    take(/(?<![\d:])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d:])/);
  if (monthDay) {
    const thisYear = DateTime.fromObject(ymd(today.year, monthDay[1], monthDay[2]), { zone: ZONE });
    // 반년 넘게 지난 날짜면 내년으로 본다(예: 12월에 쓴 '1/5').
    return isoDate(thisYear < today.minus({ days: 183 }) ? thisYear.plus({ years: 1 }) : thisYear);
  }

  // '다음 달 첫째 주 금요일'처럼 달 기준 표현은 규칙이 풀지 않는다(요일만 보고 이번 주로 잘못 잡지 않게).
  if (MONTH_RELATIVE.test(current())) {
    return null;
  }

  const week = take(/(이번\s*주|다다음\s*주|다음\s*주|담주)\s*([월화수목금토일])(?:요일)?/);
  if (week) {
    const offset = /다다음/.test(week[1]!) ? 2 : /이번/.test(week[1]!) ? 0 : 1;
    const monday = today.minus({ days: today.weekday - 1 });
    return isoDate(monday.plus({ weeks: offset, days: WEEKDAYS.indexOf(week[2]!) }));
  }

  const weekday = take(/([월화수목금토일])요일/);
  if (weekday) {
    const diff = (WEEKDAYS.indexOf(weekday[1]!) + 1 - today.weekday + 7) % 7;
    if (diff === 0) {
      assumptions.push(`${weekday[1]}요일을 오늘로 봄`);
    }
    return isoDate(today.plus({ days: diff }));
  }

  const relative = take(/(오늘|내일|모레|글피)/);
  if (relative) {
    return isoDate(today.plus({ days: RELATIVE_DAYS.indexOf(relative[1]!) }));
  }
  return null;
}

interface TimeToken {
  raw: string;
  period: string | undefined;
  hour: number;
  minute: number;
}

function takeTimes(
  take: Take,
  ctx: ParseContext,
  assumptions: string[],
): { startTime: string | null; endTime: string | null } {
  const range = take(new RegExp(`${TIME}\\s*(?:~|-|–|부터)\\s*${TIME}(?:\\s*까지)?`));
  if (range) {
    const first = tokenAt(range, 1);
    const second = tokenAt(range, 6);
    // '오후 3시~5시'의 5시는 앞의 오후를 따른다.
    const secondWithPeriod = second.period ? second : { ...second, period: first.period };
    const [start, end] = pickRange(candidates(first, ctx), candidates(secondWithPeriod, ctx));
    noteAssumption(first, start, assumptions);
    noteAssumption(secondWithPeriod, end, assumptions);
    return { startTime: hhmm(start), endTime: hhmm(end) };
  }

  const single = take(new RegExp(TIME));
  if (!single) {
    return { startTime: null, endTime: null };
  }
  const token = tokenAt(single, 1);
  const options = candidates(token, ctx);
  const start = options.length === 1 ? options[0]! : null;
  noteAssumption(token, start, assumptions);
  if (start === null) {
    return { startTime: null, endTime: null };
  }

  const duration =
    take(/(\d{1,2}(?:\.\d+)?)\s*시간(?:\s*(\d{1,2})\s*분)?(?:\s*동안)?/) ??
    take(/(\d{1,3})\s*분\s*동안/);
  if (!duration) {
    return { startTime: hhmm(start), endTime: null };
  }
  const minutes = duration[0].includes("시간")
    ? Math.round(Number(duration[1]) * 60) + Number(duration[2] ?? 0)
    : Number(duration[1]);
  return { startTime: hhmm(start), endTime: hhmm((start + minutes) % (24 * 60)) };
}

function tokenAt(match: RegExpExecArray, offset: number): TimeToken {
  const hour = Number(match[offset + 1]);
  const minute =
    match[offset + 3] === "반" ? 30 : Number(match[offset + 2] ?? match[offset + 4] ?? 0);
  const raw = `${hour}시${minute === 0 ? "" : minute === 30 ? " 반" : ` ${minute}분`}`;
  return { raw, period: match[offset], hour, minute };
}

/** 그 시각이 될 수 있는 값(자정부터 분). 오전·오후가 없으면 활동 시간 안의 것만 남긴다. */
function candidates({ period, hour: h, minute: m }: TimeToken, ctx: ParseContext): number[] {
  if (m > 59 || h > 23) {
    return [];
  }
  const at = (hour: number | null) => (hour === null ? [] : [hour * 60 + m]);
  switch (period) {
    case "오후":
    case "저녁":
      return at(h >= 1 && h <= 11 ? h + 12 : h === 12 || h >= 13 ? h : null);
    case "밤":
      return at(h >= 1 && h <= 5 ? h : h >= 6 && h <= 11 ? h + 12 : h >= 18 ? h : null);
    case "새벽":
      return at(h >= 1 && h <= 6 ? h : null);
    case "오전":
    case "아침":
      return at(h === 12 ? 0 : h <= 11 ? h : null);
    case "낮":
      return at(h === 12 ? 12 : h >= 1 && h <= 6 ? h + 12 : h >= 7 && h <= 11 ? h : null);
    default: {
      if (h === 0 || h >= 13) {
        return at(h);
      }
      const both = [h === 12 ? 0 : h, h === 12 ? 12 : h + 12].map((hour) => hour * 60 + m);
      return both.filter((minutes) => inActiveHours(minutes, ctx));
    }
  }
}

/** 시작·끝 후보가 여럿이면 서로 맞는 쪽(끝 ≥ 시작)을 고른다. 정할 수 없으면 null. */
function pickRange(starts: number[], ends: number[]): [number | null, number | null] {
  const [s] = starts;
  const [e] = ends;
  if (starts.length === 1 && s !== undefined && ends.length >= 1) {
    return [s, ends.find((end) => end >= s) ?? e ?? null];
  }
  if (ends.length === 1 && e !== undefined && starts.length >= 1) {
    return [[...starts].reverse().find((start) => start <= e) ?? s ?? null, e];
  }
  return [starts.length === 1 ? (s ?? null) : null, ends.length === 1 ? (e ?? null) : null];
}

/** 오전·오후 없이 1~12시로 쓴 시각을 하나로 정했으면 짐작으로 남긴다. */
function noteAssumption(token: TimeToken, value: number | null, assumptions: string[]): void {
  if (token.period || value === null || token.hour < 1 || token.hour > 12) {
    return;
  }
  const words = koreanTime(value);
  assumptions.push(`${token.raw} → ${words}${/(반|분)$/.test(words) ? "으로" : "로"} 봄`);
}

function koreanTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour =
    h === 0 ? "밤 12시" : h < 12 ? `오전 ${h}시` : h === 12 ? "낮 12시" : `오후 ${h - 12}시`;
  return m === 0 ? hour : m === 30 ? `${hour} 반` : `${hour} ${m}분`;
}

function inActiveHours(minutes: number, ctx: ParseContext): boolean {
  const start = toMinutes(ctx.activeStart);
  const end = toMinutes(ctx.activeEnd);
  // 활동 시간이 자정을 넘으면(예: 09:00~01:30) 두 구간이다.
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function takeLocation(take: Take): string | null {
  const at = take(/@\s*([^\s@]+)/);
  if (at) {
    return at[1] ?? null;
  }
  const where = take(/(\S+?)에서(?=\s)/);
  return where?.[1] ?? null;
}

function ymd(
  year: string | number | undefined,
  month: string | undefined,
  day: string | undefined,
) {
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function isoDate(date: DateTime): string | null {
  return date.isValid ? date.toISODate() : null;
}

function hhmm(minutes: number | null): string | null {
  if (minutes === null) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
