// 일정 종류 분류와 마감 판정 (키워드 규칙). 근거: docs/burden-model.md 1절

import {
  DEADLINE_KEYWORDS,
  QUIZ_KEYWORD,
  QUIZ_PREP_HOURS,
  TYPE_EXCEPTIONS,
  TYPE_PARAMS,
  TYPE_PRIORITY,
} from "../burden/params.js";
import type { Confidence, EventType, ValueSource } from "./types.js";

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
  // 제목에서 먼저 찾고, 못 찾으면 카테고리 이름에서 찾는다.
  const match = matchType(title) ?? (category ? matchType(category) : null);
  const type = match?.type ?? "other";
  const isDeadline =
    type === "exam" || textsOf({ title, category }).some((t) => containsAny(t, DEADLINE_KEYWORDS));

  return {
    type,
    confidence: match?.confidence ?? "low",
    isDeadline,
    prepHours: isDeadline ? defaultPrepHours(type, { title, category }) : null,
  };
}

/** 마감일 때 기본 준비 시간 E₀. 정할 수 없으면 null. */
export function defaultPrepHours(type: EventType, text: ClassifyInput): number | null {
  if (type === "exam" && textsOf(text).some((t) => containsAny(t, [QUIZ_KEYWORD]))) {
    return QUIZ_PREP_HOURS;
  }
  return TYPE_PARAMS[type].deadlinePrepHours;
}

/** 사용자가 고정한 값. undefined인 값은 규칙으로 정한다. */
export interface FixedValues {
  type?: EventType | undefined;
  isDeadline?: boolean | undefined;
  prepHours?: number | null | undefined;
}

export interface ClassifiedFields {
  type: EventType;
  typeSource: ValueSource;
  typeConfidence: Confidence;
  isDeadline: boolean;
  deadlineSource: ValueSource;
  prepHours: number | null;
  prepHoursSource: ValueSource;
}

/** 사용자가 고정한 값은 그대로 두고 나머지는 규칙으로 정한다(burden-model 1절 규칙 6). */
export function resolveClassification(text: ClassifyInput, fixed: FixedValues): ClassifiedFields {
  const rule = classifyEvent(text);
  const type = fixed.type ?? rule.type;
  const isDeadline = fixed.isDeadline ?? rule.isDeadline;
  const prepHours =
    fixed.prepHours !== undefined
      ? fixed.prepHours
      : isDeadline
        ? defaultPrepHours(type, text)
        : null;
  return {
    type,
    typeSource: fixed.type !== undefined ? "user" : "rule",
    typeConfidence: fixed.type !== undefined ? "high" : rule.confidence,
    isDeadline,
    deadlineSource: fixed.isDeadline !== undefined ? "user" : "rule",
    prepHours,
    prepHoursSource: fixed.prepHours !== undefined ? "user" : "rule",
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

function textsOf({ title, category }: ClassifyInput): string[] {
  return category ? [title, category] : [title];
}

function containsAny(text: string, keywords: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}
