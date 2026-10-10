import type { Category, Event } from "../generated/prisma/client.js";
import { categoryDto } from "./categories.js";
import { formatEventTimes, fromStorage, toSeoulIso } from "./time.js";
import { formatTitle } from "./title.js";

export type EventRow = Event & { category: Category | null };

/** docs/api-draft.md 'Event (응답)' */
export function eventDto(row: EventRow) {
  const { start, end } = formatEventTimes(fromStorage(row));
  return {
    id: row.id,
    googleEventId: row.googleEventId,
    displayTitle: formatTitle({ category: row.category?.name ?? null, title: row.title }),
    category: row.category && categoryDto(row.category),
    title: row.title,
    start,
    end,
    allDay: row.allDay,
    location: row.location,
    type: row.type,
    typeSource: row.typeSource,
    typeConfidence: row.typeConfidence,
    isDeadline: row.isDeadline,
    deadlineSource: row.deadlineSource,
    important: row.important,
    completedAt: row.completedAt && toSeoulIso(row.completedAt),
    prepHours: row.isDeadline ? row.prepHours : null,
    // 부담도 엔진(Phase 2)이 생기면 채운다.
    pressure: null,
  };
}
