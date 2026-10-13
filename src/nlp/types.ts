import type { Confidence, EventType } from "../events/types.js";

/** 해석할 때 쓰는 사용자 정보 */
export interface ParseContext {
  /** 오늘 날짜(서울), YYYY-MM-DD */
  today: string;
  /** 활동 시간(HH:mm). '3시'처럼 오전·오후가 없는 시각을 해석할 때 쓴다. */
  activeStart: string;
  activeEnd: string;
  /** 사용자가 이미 가진 카테고리 이름 */
  categories: string[];
}

/** 비어 있을 수 있는 초안 항목. missingFields에 이 이름이 들어간다. */
export const DRAFT_FIELDS = ["title", "date", "startTime", "endTime"] as const;
export type DraftField = (typeof DRAFT_FIELDS)[number];

/** 문장에서 뽑은 조각. 모르는 값은 null이다. */
export interface DraftParts {
  category: string | null;
  title: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  /** HH:mm (24시간제) */
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  /** '종일'이라고 썼을 때 */
  allDay: boolean;
  /** '까지'처럼 마감을 뜻하는 말이 있었을 때 */
  isDeadline: boolean;
  /** null이면 제목으로 분류한다. */
  type: EventType | null;
}

/** POST /v1/nlp/parse 응답의 draft. docs/api-draft.md '자연어 입력' */
export interface NlpDraft {
  category: string | null;
  title: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  /** POST /v1/events에 그대로 보낼 수 있는 값. 다 정해졌을 때만 채운다. */
  start: string | null;
  end: string | null;
  location: string | null;
  type: EventType;
  isDeadline: boolean;
  prepHours: number | null;
}

export interface ParseResult {
  draft: NlpDraft;
  missingFields: DraftField[];
  /** 짐작한 것. 앱이 확인 카드에 보여 준다. */
  assumptions: string[];
  confidence: Confidence;
  /** 누가 해석했는지: 규칙만 썼으면 rule, LLM이 채운 값이 있으면 llm */
  source: "rule" | "llm";
}
