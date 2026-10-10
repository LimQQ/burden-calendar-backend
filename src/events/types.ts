/** 일정 종류. prisma/schema.prisma의 EventType enum과 같은 값이다. */
export const EVENT_TYPES = [
  "class",
  "exam",
  "assignment",
  "presentation",
  "meeting",
  "parttime",
  "social",
  "exercise",
  "rest",
  "other",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type Confidence = "high" | "medium" | "low";
