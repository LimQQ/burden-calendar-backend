// 부담도 모델의 계수와 분류 규칙. 모든 값은 가정이며 이 파일에서만 조정한다.
// 근거: docs/burden-model.md 1절 표

import type { EventType } from "../events/types.js";

export const MODEL_VERSION = "v1";

export interface TypeParams {
  /** 제목에서 찾을 키워드. 영문은 대소문자를 가리지 않는다. */
  keywords: readonly string[];
  /** 시간당 가중치 w. 음수는 충전이다. */
  weightPerHour: number;
  /** 마감일 때 준비 시간 E₀(시간). null이면 사용자에게 묻는다. */
  deadlinePrepHours: number | null;
}

export const TYPE_PARAMS: Record<EventType, TypeParams> = {
  class: { keywords: ["수업", "강의", "특강"], weightPerHour: 1.0, deadlinePrepHours: null },
  exam: {
    keywords: ["시험", "중간고사", "중간", "기말", "퀴즈"],
    weightPerHour: 2.0,
    deadlinePrepHours: 10,
  },
  assignment: {
    keywords: ["과제", "레포트", "보고서", "제출"],
    weightPerHour: 1.2,
    deadlinePrepHours: 2,
  },
  presentation: {
    keywords: ["발표", "PT", "프레젠테이션"],
    weightPerHour: 1.5,
    deadlinePrepHours: 6,
  },
  meeting: {
    keywords: ["팀플", "회의", "미팅", "스터디", "면담"],
    weightPerHour: 1.0,
    deadlinePrepHours: null,
  },
  parttime: { keywords: ["알바", "근무", "출근"], weightPerHour: 1.4, deadlinePrepHours: null },
  social: { keywords: ["약속", "밥", "저녁", "모임"], weightPerHour: 0.6, deadlinePrepHours: null },
  exercise: {
    keywords: ["운동", "헬스", "러닝", "수영"],
    weightPerHour: -0.3,
    deadlinePrepHours: null,
  },
  rest: {
    keywords: ["휴식", "낮잠", "영화", "게임", "공연"],
    weightPerHour: -0.6,
    deadlinePrepHours: null,
  },
  other: { keywords: [], weightPerHour: 1.0, deadlinePrepHours: null },
};

/** 시험 중 퀴즈의 준비 시간 */
export const QUIZ_KEYWORD = "퀴즈";
export const QUIZ_PREP_HOURS = 2;

/** 여러 종류가 걸렸을 때 앞쪽을 고른다. other는 일치가 없을 때만 쓴다. */
export const TYPE_PRIORITY = [
  "exam",
  "presentation",
  "assignment",
  "parttime",
  "class",
  "meeting",
  "social",
  "exercise",
  "rest",
] as const satisfies readonly Exclude<EventType, "other">[];

/** 키워드보다 먼저 보는 예외 사전. '중간'에 걸려 시험이 되는 것을 막는다. */
export const TYPE_EXCEPTIONS: ReadonlyArray<readonly [phrase: string, type: EventType]> = [
  ["중간점검", "presentation"],
  ["중간발표", "presentation"],
];

/** 이 단어가 있으면 마감으로 본다(종류가 exam이어도 마감). */
export const DEADLINE_KEYWORDS = ["마감", "제출"] as const;
