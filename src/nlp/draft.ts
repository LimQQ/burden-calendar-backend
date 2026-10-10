// 해석한 조각(DraftParts)을 API 응답(ParseResult)으로 만든다. 규칙과 LLM이 같이 쓴다.

import { DateTime } from "luxon";
import { classifyEvent, defaultPrepHours } from "../events/classify.js";
import { addDays, toSeoulIso, ZONE } from "../events/time.js";
import type { DraftField, DraftParts, ParseResult } from "./types.js";

export const ASSUME_ALL_DAY_DEADLINE = "시각이 없어 그날 종일 마감으로 둠";

export function buildResult(
  parts: DraftParts,
  extra: { assumptions: string[]; source: ParseResult["source"] },
): ParseResult {
  const title = parts.title?.trim() ?? "";
  const classification = classifyEvent({ title, category: parts.category });
  const type = parts.type ?? classification.type;
  const isDeadline = parts.isDeadline || classification.isDeadline || type === "exam";
  const assumptions = [...extra.assumptions];

  // 마감인데 날짜만 있으면 그날 종일 마감이다. 날짜는 확실하므로 짐작이 아니다.
  let allDay = parts.allDay;
  if (!allDay && isDeadline && parts.date && !parts.startTime) {
    allDay = true;
    assumptions.push(ASSUME_ALL_DAY_DEADLINE);
  }
  const startTime = allDay ? null : parts.startTime;
  // 시각이 하나뿐인 마감은 그 시각에 끝나는 일정(시작 = 종료)이다.
  const endTime = allDay ? null : (parts.endTime ?? (isDeadline ? startTime : null));

  const missingFields = (
    [
      ["title", !title],
      ["date", !parts.date],
      ["startTime", !allDay && !startTime],
      ["endTime", !allDay && !!startTime && !endTime],
    ] as const
  )
    .filter(([, missing]) => missing)
    .map(([field]): DraftField => field);

  let start: string | null = null;
  let end: string | null = null;
  if (parts.date && allDay) {
    start = parts.date;
    end = parts.date;
  } else if (parts.date && startTime && endTime) {
    start = isoAt(parts.date, startTime);
    // 끝 시각이 시작보다 이르면 다음 날로 넘어간 것이다(예: 23시~1시).
    end = isoAt(endTime < startTime ? addDays(parts.date, 1) : parts.date, endTime);
  }

  return {
    draft: {
      category: parts.category,
      title,
      date: parts.date,
      startTime,
      endTime,
      allDay,
      start,
      end,
      location: parts.location,
      type,
      isDeadline,
      prepHours: isDeadline ? defaultPrepHours(type, { title, category: parts.category }) : null,
    },
    missingFields,
    assumptions,
    confidence: confidenceOf(missingFields, assumptions),
    source: extra.source,
  };
}

/** 빈 값이 없고 짐작도 없으면 high, 끝 시각만 비었거나 짐작이 있으면 medium, 그 밖은 low */
function confidenceOf(missing: DraftField[], assumptions: string[]): ParseResult["confidence"] {
  if (missing.some((field) => field !== "endTime")) {
    return "low";
  }
  return missing.length === 0 && assumptions.length === 0 ? "high" : "medium";
}

function isoAt(date: string, time: string): string {
  return toSeoulIso(DateTime.fromISO(`${date}T${time}`, { zone: ZONE }).toJSDate());
}
