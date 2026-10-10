import { describe, expect, it } from "vitest";
import { buildPrompt, mergeParts, partsFromLlm } from "../../src/nlp/llm.js";
import type { DraftParts } from "../../src/nlp/types.js";

const valid = {
  title: "회식",
  category: "동아리",
  date: "2026-11-06",
  startTime: "19:00",
  endTime: "",
  location: "",
  allDay: false,
  isDeadline: false,
  type: "social",
  missingFields: ["endTime"],
  assumptions: ["다음 달 첫째 주 금요일을 11월 6일로 봄"],
};

const emptyRule: DraftParts = {
  category: null,
  title: null,
  date: null,
  startTime: null,
  endTime: null,
  location: null,
  allDay: false,
  isDeadline: false,
  type: null,
};

describe("partsFromLlm", () => {
  it("맞는 출력을 조각으로 바꾸고 빈 문자열은 null로 둔다", () => {
    expect(partsFromLlm(valid)).toEqual({
      parts: {
        category: "동아리",
        title: "회식",
        date: "2026-11-06",
        startTime: "19:00",
        endTime: null,
        location: null,
        allDay: false,
        isDeadline: false,
        type: "social",
      },
      missing: ["endTime"],
      assumptions: ["다음 달 첫째 주 금요일을 11월 6일로 봄"],
    });
  });

  it("형식이 틀린 값은 버린다", () => {
    const parsed = partsFromLlm({
      ...valid,
      date: "2026-02-30",
      startTime: "25:00",
      type: "party",
      missingFields: ["date", "foo"],
    });
    expect(parsed?.parts).toMatchObject({ date: null, startTime: null, type: null });
    expect(parsed?.missing).toEqual(["date"]);
  });

  it("제목에 붙은 [카테고리]는 떼어 낸다", () => {
    expect(partsFromLlm({ ...valid, title: "[캡스톤] 회의", category: "" })?.parts).toMatchObject({
      category: "캡스톤",
      title: "회의",
    });
  });

  it("모양이 틀리면 null", () => {
    expect(partsFromLlm("not json")).toBeNull();
    expect(partsFromLlm({ title: "회의" })).toBeNull();
  });
});

describe("mergeParts", () => {
  it("규칙이 찾은 날짜·시각을 따르고, 제목·종류는 LLM을 쓴다", () => {
    const llm = partsFromLlm({ ...valid, date: "2026-12-25", startTime: "20:00" })!;
    const merged = mergeParts(
      { ...emptyRule, title: "다음 달 첫째 주 회식", date: "2026-11-06", startTime: "19:00" },
      llm,
    );
    expect(merged).toMatchObject({
      title: "회식",
      date: "2026-11-06",
      startTime: "19:00",
      category: "동아리",
      type: "social",
    });
  });

  it("규칙이 못 찾은 값을 채우되, 모델이 모른다고 한 항목은 비운다", () => {
    const llm = partsFromLlm({ ...valid, missingFields: ["startTime"] })!;
    expect(mergeParts(emptyRule, llm)).toMatchObject({ date: "2026-11-06", startTime: null });
  });
});

describe("buildPrompt", () => {
  it("오늘, 2주 날짜표, 활동 시간, 카테고리, 문장을 담는다", () => {
    const prompt = buildPrompt("다음 주 금 회식", {
      today: "2026-10-07",
      activeStart: "09:00",
      activeEnd: "22:00",
      categories: ["동아리"],
    });
    expect(prompt).toContain("오늘: 2026-10-07(수)");
    expect(prompt).toContain("2026-10-21(수)");
    expect(prompt).toContain("활동 시간: 09:00~22:00");
    expect(prompt).toContain("내 카테고리: 동아리");
    expect(prompt).toContain("문장: 다음 주 금 회식");
  });
});
