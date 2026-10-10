import { describe, expect, it } from "vitest";
import { formatTitle, parseTitle } from "../../src/events/title.js";

describe("parseTitle", () => {
  it.each([
    ["[지능HCI] 회의", { category: "지능HCI", title: "회의" }],
    ["  [ 데이터베이스 ]   중간고사  ", { category: "데이터베이스", title: "중간고사" }],
    ["[] 산책", { category: null, title: "산책" }],
    ["[   ] 산책", { category: null, title: "산책" }],
    ["중간고사 @ 공학관 101", { category: null, title: "중간고사 @ 공학관 101" }],
    ["회의 [지능HCI]", { category: null, title: "회의 [지능HCI]" }],
    ["[a] [b] 일정", { category: "a", title: "[b] 일정" }],
    ["[지능HCI]", { category: "지능HCI", title: "" }],
  ])("%s", (raw, expected) => {
    expect(parseTitle(raw)).toEqual(expected);
  });
});

describe("formatTitle", () => {
  it("카테고리가 있으면 `[카테고리] 제목`", () => {
    expect(formatTitle({ category: "지능HCI", title: "회의" })).toBe("[지능HCI] 회의");
  });

  it("카테고리가 없으면 제목만", () => {
    expect(formatTitle({ category: null, title: "회의" })).toBe("회의");
  });

  it("제목이 비어 있으면 `[카테고리]`만", () => {
    expect(formatTitle({ category: "지능HCI", title: "" })).toBe("[지능HCI]");
  });

  it("parseTitle과 되돌리기가 맞는다", () => {
    const raw = "[데이터베이스] 중간고사";
    expect(formatTitle(parseTitle(raw))).toBe(raw);
  });
});
