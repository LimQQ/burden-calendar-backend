import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/errors.js";
import {
  addMonths,
  dateRange,
  formatEventTimes,
  fromStorage,
  parseEventTimes,
  todayInSeoul,
  toStorage,
} from "../../src/events/time.js";

describe("parseEventTimes", () => {
  it("종일 일정은 날짜로 받는다", () => {
    expect(parseEventTimes(true, "2026-10-23", "2026-10-25")).toEqual({
      allDay: true,
      startDate: "2026-10-23",
      endDate: "2026-10-25",
    });
  });

  it("시간 있는 일정은 시간대가 붙은 ISO 시각으로 받는다", () => {
    expect(parseEventTimes(false, "2026-10-21T15:00:00+09:00", "2026-10-21T07:00:00Z")).toEqual({
      allDay: false,
      startAt: new Date("2026-10-21T06:00:00Z"),
      endAt: new Date("2026-10-21T07:00:00Z"),
    });
  });

  it.each([
    [true, "2026-10-23T09:00:00+09:00", "2026-10-23", "YYYY-MM-DD"],
    [true, "2026-02-30", "2026-03-01", "YYYY-MM-DD"],
    [false, "2026-10-21T15:00:00", "2026-10-21T16:00:00", "시간대"],
    [false, "2026-10-21", "2026-10-21", "시간대"],
    [true, "2026-10-25", "2026-10-23", "빠릅니다"],
    [false, "2026-10-21T16:00:00+09:00", "2026-10-21T15:00:00+09:00", "빠릅니다"],
  ])("allDay=%s %s ~ %s 는 400", (allDay, start, end, message) => {
    const call = () => parseEventTimes(allDay, start, end);
    expect(call).toThrow(ApiError);
    expect(call).toThrow(message);
  });
});

describe("저장 형식", () => {
  it("종일 일정은 서울 0시 기준 [시작일, 마지막 날 다음 날)로 저장한다", () => {
    const stored = toStorage({ allDay: true, startDate: "2026-10-23", endDate: "2026-10-24" });
    expect(stored).toEqual({
      allDay: true,
      startAt: new Date("2026-10-22T15:00:00Z"),
      endAt: new Date("2026-10-24T15:00:00Z"),
    });
    expect(fromStorage(stored)).toEqual({
      allDay: true,
      startDate: "2026-10-23",
      endDate: "2026-10-24",
    });
  });

  it("응답의 시각은 서울 오프셋을 붙인다", () => {
    expect(
      formatEventTimes({
        allDay: false,
        startAt: new Date("2026-10-21T06:00:00Z"),
        endAt: new Date("2026-10-21T15:30:00Z"),
      }),
    ).toEqual({ start: "2026-10-21T15:00:00+09:00", end: "2026-10-22T00:30:00+09:00" });
  });
});

describe("날짜 계산", () => {
  it("dateRange는 양 끝 날짜를 포함하는 [시작, 끝)", () => {
    expect(dateRange("2026-10-21", "2026-10-22")).toEqual({
      start: new Date("2026-10-20T15:00:00Z"),
      end: new Date("2026-10-22T15:00:00Z"),
    });
  });

  it("오늘은 서울 날짜로 센다", () => {
    expect(todayInSeoul(new Date("2026-10-20T15:30:00Z"))).toBe("2026-10-21");
  });

  it("addMonths는 달 끝을 맞춘다", () => {
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
  });
});
