// 일정 종류 분류와 마감 판정 (키워드 규칙). 근거: docs/burden-model.md 1절

import {
  DEADLINE_KEYWORDS,
  QUIZ_KEYWORD,
  QUIZ_PREP_HOURS,
  TYPE_EXCEPTIONS,
  TYPE_PARAMS,
  TYPE_PRIORITY,
} from "../burden/params.js";
import type { Confidence, EventType } from "./types.js";

export interface ClassifyInput {
  /** `[카테고리]`를 뗀 제목 */
  title: string;
  category: string | null;
}

export interface Classification {
  type: EventType;
  confidence: Confidence;
  isDeadline: boolean;
  /** 마감일 때 기본 준비 시간. 마감이 아니거나 정할 수 없으면 null(사용자에게 묻는다). */
  prepHours: number | null;
}

export function classifyEvent({ title, category }: ClassifyInput): Classification {
  const texts = category ? [title, category] : [title];
  // 제목에서 먼저 찾고, 못 찾으면 카테고리 이름에서 찾는다.
  const match = matchType(title) ?? (category ? matchType(category) : null);
  const type = match?.type ?? "other";
  const isDeadline = type === "exam" || texts.some((text) => containsAny(text, DEADLINE_KEYWORDS));

  return {
    type,
    confidence: match?.confidence ?? "low",
    isDeadline,
    prepHours: isDeadline ? defaultPrepHours(type, texts) : null,
  };
}

function matchType(text: string): { type: EventType; confidence: Confidence } | null {
  for (const [phrase, type] of TYPE_EXCEPTIONS) {
    if (containsAny(text, [phrase])) {
      return { type, confidence: "high" };
    }
  }
  // TYPE_PRIORITY 순서로 거르므로 첫 번째가 우선순위가 가장 높은 종류다.
  const matched = TYPE_PRIORITY.filter((type) => containsAny(text, TYPE_PARAMS[type].keywords));
  const [first] = matched;
  if (first === undefined) {
    return null;
  }
  return { type: first, confidence: matched.length === 1 ? "high" : "medium" };
}

function defaultPrepHours(type: EventType, texts: readonly string[]): number | null {
  if (type === "exam" && texts.some((text) => containsAny(text, [QUIZ_KEYWORD]))) {
    return QUIZ_PREP_HOURS;
  }
  return TYPE_PARAMS[type].deadlinePrepHours;
}

function containsAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}
