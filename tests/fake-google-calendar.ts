import { toStorage } from "../src/events/time.js";
import {
  GoogleApiError,
  type GoogleCalendar,
  GoogleReauthError,
  type RemoteEvent,
  type RemoteEventInput,
} from "../src/google/calendar.js";

/** 메모리에만 있는 가짜 구글 캘린더 */
export class FakeGoogleCalendar implements GoogleCalendar {
  readonly events = new Map<string, RemoteEvent>();
  /** 부른 메서드 이름 순서 */
  readonly calls: string[] = [];
  /** factory에 넘어온 refresh token */
  readonly refreshTokens: string[] = [];
  lastListRange: { timeMin: Date; timeMax: Date } | null = null;
  failWith: "api" | "reauth" | null = null;
  private nextId = 1;

  readonly factory = (refreshToken: string): GoogleCalendar => {
    this.refreshTokens.push(refreshToken);
    return this;
  };

  /** 구글 쪽에 일정을 직접 넣는다(사용자가 구글 캘린더 앱에서 만든 것처럼). */
  add(input: RemoteEventInput): RemoteEvent {
    const event = { googleEventId: `g${this.nextId++}`, ...input };
    this.events.set(event.googleEventId, event);
    return event;
  }

  async list(timeMin: Date, timeMax: Date): Promise<RemoteEvent[]> {
    this.record("list");
    this.lastListRange = { timeMin, timeMax };
    return [...this.events.values()].filter((event) => {
      const { startAt, endAt } = toStorage(event.times);
      return startAt < timeMax && (endAt > timeMin || startAt >= timeMin);
    });
  }

  async insert(input: RemoteEventInput): Promise<RemoteEvent> {
    this.record("insert");
    return this.add(input);
  }

  async patch(googleEventId: string, input: Partial<RemoteEventInput>): Promise<RemoteEvent> {
    this.record("patch");
    const current = this.events.get(googleEventId);
    if (!current) {
      throw new GoogleApiError("Not Found", 404);
    }
    const next = { ...current, ...input };
    this.events.set(googleEventId, next);
    return next;
  }

  async remove(googleEventId: string): Promise<void> {
    this.record("remove");
    this.events.delete(googleEventId);
  }

  private record(method: string): void {
    this.calls.push(method);
    if (this.failWith === "api") {
      throw new GoogleApiError("Backend Error", 500);
    }
    if (this.failWith === "reauth") {
      throw new GoogleReauthError("invalid_grant");
    }
  }
}
