import { describe, expect, it } from "vitest";
import { fromGoogle } from "../../src/google/calendar.js";

describe("fromGoogle", () => {
  it("종일 일정의 end(다음 날)를 마지막 날로 바꾼다", () => {
    expect(
      fromGoogle({
        id: "a",
        summary: "[과제] DB 3장",
        start: { date: "2026-10-23" },
        end: { date: "2026-10-25" },
      }),
    ).toEqual({
      googleEventId: "a",
      summary: "[과제] DB 3장",
      location: null,
      times: { allDay: true, startDate: "2026-10-23", endDate: "2026-10-24" },
    });
  });

  it("시간 있는 일정은 시각 그대로", () => {
    expect(
      fromGoogle({
        id: "b",
        summary: "회의",
        location: "도서관",
        start: { dateTime: "2026-10-21T15:00:00+09:00", timeZone: "Asia/Seoul" },
        end: { dateTime: "2026-10-21T16:00:00+09:00", timeZone: "Asia/Seoul" },
      }),
    ).toEqual({
      googleEventId: "b",
      summary: "회의",
      location: "도서관",
      times: {
        allDay: false,
        startAt: new Date("2026-10-21T06:00:00Z"),
        endAt: new Date("2026-10-21T07:00:00Z"),
      },
    });
  });

  it("제목이 없으면 빈 문자열", () => {
    expect(fromGoogle({ id: "c", start: { date: "2026-10-23" } })?.summary).toBe("");
  });

  it("취소된 일정, id나 시간이 없는 일정은 건너뛴다", () => {
    expect(fromGoogle({ id: "d", status: "cancelled", start: { date: "2026-10-23" } })).toBeNull();
    expect(fromGoogle({ start: { date: "2026-10-23" } })).toBeNull();
    expect(fromGoogle({ id: "e" })).toBeNull();
  });
});
