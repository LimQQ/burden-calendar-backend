import { describe, expect, it } from "vitest";
import { ASSUME_ALL_DAY_DEADLINE, buildResult } from "../../src/nlp/draft.js";
import { parseWithRules } from "../../src/nlp/rules.js";
import type { ParseContext } from "../../src/nlp/types.js";

// 오늘 = 2026-10-07(수), 활동 시간 09:00~22:00
const ctx: ParseContext = {
  today: "2026-10-07",
  activeStart: "09:00",
  activeEnd: "22:00",
  categories: ["지능HCI", "데이터베이스", "운영체제", "동아리"],
};

function parse(text: string) {
  const { parts, assumptions } = parseWithRules(text, ctx);
  return buildResult(parts, { assumptions, source: "rule" });
}

describe("문서·프로토타입 예시", () => {
  it("내일 3시 지능HCI 회의 도서관에서 (docs/api-draft.md 예시)", () => {
    expect(parse("내일 3시 지능HCI 회의 도서관에서")).toEqual({
      draft: {
        category: "지능HCI",
        title: "회의",
        date: "2026-10-08",
        startTime: "15:00",
        endTime: null,
        allDay: false,
        start: null,
        end: null,
        location: "도서관",
        type: "meeting",
        isDeadline: false,
        prepHours: null,
      },
      missingFields: ["endTime"],
      assumptions: ["3시 → 오후 3시로 봄"],
      confidence: "medium",
      source: "rule",
    });
  });

  it("담주 수요일까지 지능HCI 개인 리포트 제출 → 그날 종일 마감", () => {
    const result = parse("담주 수요일까지 지능HCI 개인 리포트 제출");
    expect(result.draft).toMatchObject({
      category: "지능HCI",
      title: "개인 리포트 제출",
      date: "2026-10-14",
      allDay: true,
      start: "2026-10-14",
      end: "2026-10-14",
      type: "assignment",
      isDeadline: true,
      prepHours: 2,
    });
    expect(result.missingFields).toEqual([]);
    expect(result.assumptions).toEqual([ASSUME_ALL_DAY_DEADLINE]);
  });

  it("내일 저녁 7시에 동아리 회식", () => {
    const result = parse("내일 저녁 7시에 동아리 회식");
    expect(result.draft).toMatchObject({
      category: "동아리",
      title: "회식",
      date: "2026-10-08",
      startTime: "19:00",
      type: "social",
    });
    expect(result.missingFields).toEqual(["endTime"]);
    expect(result.assumptions).toEqual([]);
  });

  it("10/23 오후 2시 운영체제 중간고사 → 시험은 그 시각 마감", () => {
    const result = parse("10/23 오후 2시 운영체제 중간고사");
    expect(result.draft).toMatchObject({
      category: "운영체제",
      title: "중간고사",
      start: "2026-10-23T14:00:00+09:00",
      end: "2026-10-23T14:00:00+09:00",
      type: "exam",
      isDeadline: true,
      prepHours: 10,
    });
    expect(result.confidence).toBe("high");
  });
});

describe("날짜", () => {
  it.each([
    ["2026-11-02 수업 9시 반", "2026-11-02"],
    ["10월 21일 회의", "2026-10-21"],
    ["모레 회의", "2026-10-09"],
    ["글피 회의", "2026-10-10"],
    ["금요일 회의", "2026-10-09"],
    ["이번 주 금 회의", "2026-10-09"],
    ["다음 주 월요일 회의", "2026-10-12"],
    ["다다음주 화요일 회의", "2026-10-20"],
    ["1/5 개강", "2027-01-05"],
  ])("%s → %s", (text, date) => {
    expect(parse(text).draft.date).toBe(date);
  });

  it("오늘과 같은 요일은 오늘로 보고 짐작으로 남긴다", () => {
    const result = parse("수요일 회의");
    expect(result.draft.date).toBe("2026-10-07");
    expect(result.assumptions).toContain("수요일을 오늘로 봄");
  });

  it("'다음 달 첫째 주 금요일'은 규칙이 풀지 않는다", () => {
    expect(parse("다음 달 첫째 주 금요일 회식").missingFields).toContain("date");
  });

  it("날짜가 없으면 비워 둔다", () => {
    expect(parse("팀플 회의")).toMatchObject({
      draft: { title: "팀플 회의", date: null, start: null },
      missingFields: ["date", "startTime"],
      confidence: "low",
    });
  });
});

describe("시각", () => {
  it("오후 3시~5시: 끝 시각은 앞의 오후를 따른다", () => {
    expect(parse("금요일 오후 3시~5시 [지능HCI] 팀플")).toMatchObject({
      draft: {
        category: "지능HCI",
        title: "팀플",
        start: "2026-10-09T15:00:00+09:00",
        end: "2026-10-09T17:00:00+09:00",
        type: "meeting",
      },
      missingFields: [],
      assumptions: [],
      confidence: "high",
    });
  });

  it("오전·오후가 둘 다 활동 시간 안이면 채우지 않는다", () => {
    expect(parse("내일 9시 회의")).toMatchObject({
      draft: { startTime: null },
      missingFields: ["startTime"],
      confidence: "low",
    });
  });

  it("시작 + 'N시간'으로 끝 시각을 정한다", () => {
    const result = parse("모레 10시부터 2시간 스터디");
    expect(result.draft).toMatchObject({
      title: "스터디",
      start: "2026-10-09T10:00:00+09:00",
      end: "2026-10-09T12:00:00+09:00",
    });
    expect(result.assumptions).toEqual(["10시 → 오전 10시로 봄"]);
  });

  it("'반'과 'N분'", () => {
    expect(parse("10시 반 면담").draft.startTime).toBe("10:30");
    expect(parse("오후 3시 20분 면담").draft.startTime).toBe("15:20");
    expect(parse("15:40 면담").draft.startTime).toBe("15:40");
  });

  it("'3시간'은 시각이 아니다", () => {
    expect(parse("내일 3시간 공부").draft.startTime).toBeNull();
  });

  it("하루 종일", () => {
    expect(parse("토요일 하루 종일 MT")).toMatchObject({
      draft: { title: "MT", allDay: true, start: "2026-10-10", end: "2026-10-10" },
      missingFields: [],
      confidence: "high",
    });
  });
});

describe("장소·카테고리", () => {
  it("@장소와 이미 있는 카테고리 이름", () => {
    expect(parse("다음 주 월요일 오전 9시 반 데이터베이스 수업 @공학관").draft).toMatchObject({
      category: "데이터베이스",
      title: "수업",
      location: "공학관",
      startTime: "09:30",
      type: "class",
    });
  });

  it("[ ] 안의 새 카테고리", () => {
    expect(parse("내일 [캡스톤] 회의 2시").draft).toMatchObject({
      category: "캡스톤",
      title: "회의",
      startTime: "14:00",
    });
  });
});
