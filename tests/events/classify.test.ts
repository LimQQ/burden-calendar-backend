import { describe, expect, it } from "vitest";
import { classifyEvent } from "../../src/events/classify.js";
import { parseTitle } from "../../src/events/title.js";

// docs/burden-model.md 7절 '종류 분류' 표 C1~C7.
// prepHours는 1절 표의 E₀(마감일 때 준비 시간)에서 나온 값이다.
describe("문서 테스트 예시 C1~C7", () => {
  it.each([
    ["C1", "[지능HCI] 회의", "지능HCI", "회의", "meeting", "high", false, null],
    ["C2", "[데이터베이스] 중간고사", "데이터베이스", "중간고사", "exam", "high", true, 10],
    ["C3", "[지능HCI] 중간발표", "지능HCI", "중간발표", "presentation", "high", false, null],
    ["C4", "[과제] DB 3장", "과제", "DB 3장", "assignment", "high", false, null],
    [
      "C5",
      "[지능HCI] 발표 자료 제출",
      "지능HCI",
      "발표 자료 제출",
      "presentation",
      "medium",
      true,
      6,
    ],
    ["C6", "중간고사 @ 공학관 101", null, "중간고사 @ 공학관 101", "exam", "high", true, 10],
    ["C7", "[] 산책", null, "산책", "other", "low", false, null],
  ] as const)("%s %s", (_id, raw, category, title, type, confidence, isDeadline, prepHours) => {
    const parsed = parseTitle(raw);
    expect(parsed).toEqual({ category, title });
    expect(classifyEvent(parsed)).toEqual({ type, confidence, isDeadline, prepHours });
  });
});

describe("classifyEvent 추가 규칙", () => {
  it("퀴즈는 시험이고 준비 시간은 2시간", () => {
    expect(classifyEvent({ title: "DB 퀴즈", category: null })).toMatchObject({
      type: "exam",
      isDeadline: true,
      prepHours: 2,
    });
  });

  it("'중간'만 있어도 시험으로 본다", () => {
    expect(classifyEvent({ title: "DB 중간", category: null }).type).toBe("exam");
  });

  it("영문 키워드는 대소문자를 가리지 않는다", () => {
    expect(classifyEvent({ title: "캡스톤 pt", category: null }).type).toBe("presentation");
  });

  it("여러 종류가 걸리면 우선순위가 높은 쪽, 확신도 medium", () => {
    expect(classifyEvent({ title: "저녁 수업", category: null })).toMatchObject({
      type: "class",
      confidence: "medium",
    });
  });

  it("제목에서 찾으면 카테고리 이름은 보지 않는다", () => {
    expect(classifyEvent({ title: "회의", category: "알바" }).type).toBe("meeting");
  });

  it("카테고리 이름의 마감 키워드도 본다", () => {
    expect(classifyEvent({ title: "DB 3장", category: "과제 제출" }).isDeadline).toBe(true);
  });

  it("E₀가 없는 종류의 마감은 준비 시간을 비워 둔다(사용자에게 묻는다)", () => {
    expect(classifyEvent({ title: "스터디 자료 마감", category: null })).toMatchObject({
      type: "meeting",
      isDeadline: true,
      prepHours: null,
    });
    expect(classifyEvent({ title: "신청서 마감", category: null })).toEqual({
      type: "other",
      confidence: "low",
      isDeadline: true,
      prepHours: null,
    });
  });
});
