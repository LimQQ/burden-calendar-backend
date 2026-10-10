// 구글 캘린더 API 래퍼. 사용자의 기본(primary) 캘린더만 다룬다.

import { calendar, type calendar_v3 } from "@googleapis/calendar";
import { OAuth2Client } from "google-auth-library";
import { addDays, type EventTimes, toSeoulIso, ZONE } from "../events/time.js";

export interface RemoteEventInput {
  /** `[카테고리] 일정 제목` */
  summary: string;
  location: string | null;
  times: EventTimes;
}

export interface RemoteEvent extends RemoteEventInput {
  googleEventId: string;
}

export interface GoogleCalendar {
  /** 기간과 겹치는 일정. 반복 일정은 회차별로 펼친다. */
  list(timeMin: Date, timeMax: Date): Promise<RemoteEvent[]>;
  insert(input: RemoteEventInput): Promise<RemoteEvent>;
  /** 보낸 필드만 바꾼다. */
  patch(googleEventId: string, input: Partial<RemoteEventInput>): Promise<RemoteEvent>;
  /** 이미 지워진 일정이면 아무것도 하지 않는다. */
  remove(googleEventId: string): Promise<void>;
}

/** 사용자의 refresh token으로 그 사용자의 캘린더 클라이언트를 만든다. */
export type GoogleCalendarFactory = (refreshToken: string) => GoogleCalendar;

/** refresh token이 만료·취소됐거나 권한이 없다. 사용자가 다시 로그인해야 한다. */
export class GoogleReauthError extends Error {
  override readonly name = "GoogleReauthError";
}

export class GoogleApiError extends Error {
  override readonly name = "GoogleApiError";
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

const CALENDAR_ID = "primary";

export function createGoogleCalendarFactory(config: {
  clientId: string;
  clientSecret: string;
}): GoogleCalendarFactory {
  return (refreshToken) => {
    const auth = new OAuth2Client(config);
    auth.setCredentials({ refresh_token: refreshToken });
    const api = calendar({ version: "v3", auth });

    return {
      async list(timeMin, timeMax) {
        const events: RemoteEvent[] = [];
        let pageToken: string | undefined;
        do {
          const { data } = await call(() =>
            api.events.list({
              calendarId: CALENDAR_ID,
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              singleEvents: true,
              maxResults: 2500,
              ...(pageToken && { pageToken }),
            }),
          );
          for (const item of data.items ?? []) {
            const event = fromGoogle(item);
            if (event) {
              events.push(event);
            }
          }
          pageToken = data.nextPageToken ?? undefined;
        } while (pageToken);
        return events;
      },
      async insert(input) {
        const { data } = await call(() =>
          api.events.insert({ calendarId: CALENDAR_ID, requestBody: toGoogle(input) }),
        );
        return fromGoogleOrThrow(data);
      },
      async patch(googleEventId, input) {
        const { data } = await call(() =>
          api.events.patch({
            calendarId: CALENDAR_ID,
            eventId: googleEventId,
            requestBody: toGoogle(input),
          }),
        );
        return fromGoogleOrThrow(data);
      },
      async remove(googleEventId) {
        try {
          await call(() => api.events.delete({ calendarId: CALENDAR_ID, eventId: googleEventId }));
        } catch (err) {
          if (err instanceof GoogleApiError && (err.status === 404 || err.status === 410)) {
            return;
          }
          throw err;
        }
      },
    };
  };
}

function toGoogle(input: Partial<RemoteEventInput>): calendar_v3.Schema$Event {
  const body: calendar_v3.Schema$Event = {};
  if (input.summary !== undefined) {
    body.summary = input.summary;
  }
  if (input.location !== undefined) {
    // 빈 문자열을 보내야 구글에서 장소가 지워진다.
    body.location = input.location ?? "";
  }
  if (input.times) {
    const { times } = input;
    if (times.allDay) {
      // 구글의 종일 일정 end는 마지막 날의 다음 날이다.
      body.start = { date: times.startDate, dateTime: null };
      body.end = { date: addDays(times.endDate, 1), dateTime: null };
    } else {
      body.start = { dateTime: toSeoulIso(times.startAt), timeZone: ZONE, date: null };
      body.end = { dateTime: toSeoulIso(times.endAt), timeZone: ZONE, date: null };
    }
  }
  return body;
}

/** 취소됐거나 시간을 알 수 없는 일정은 null */
export function fromGoogle(item: calendar_v3.Schema$Event): RemoteEvent | null {
  if (!item.id || item.status === "cancelled") {
    return null;
  }
  let times: EventTimes;
  if (item.start?.date) {
    const startDate = item.start.date;
    const endExclusive = item.end?.date ?? addDays(startDate, 1);
    const lastDay = addDays(endExclusive, -1);
    times = { allDay: true, startDate, endDate: lastDay < startDate ? startDate : lastDay };
  } else if (item.start?.dateTime) {
    const startAt = new Date(item.start.dateTime);
    times = { allDay: false, startAt, endAt: new Date(item.end?.dateTime ?? item.start.dateTime) };
  } else {
    return null;
  }
  return {
    googleEventId: item.id,
    summary: item.summary ?? "",
    location: item.location || null,
    times,
  };
}

function fromGoogleOrThrow(item: calendar_v3.Schema$Event): RemoteEvent {
  const event = fromGoogle(item);
  if (!event) {
    throw new GoogleApiError("구글 캘린더가 알 수 없는 일정을 돌려줬습니다.", null);
  }
  return event;
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw toGoogleError(err);
  }
}

interface GaxiosLikeError {
  message?: string;
  status?: number;
  response?: { status?: number; data?: unknown };
}

function toGoogleError(err: unknown): Error {
  const e = (typeof err === "object" && err !== null ? err : {}) as GaxiosLikeError;
  const status = e.response?.status ?? e.status ?? null;
  const data = e.response?.data;
  const tokenError =
    typeof data === "object" && data !== null && "error" in data ? data.error : undefined;
  if (tokenError === "invalid_grant" || status === 401 || e.message?.includes("invalid_grant")) {
    return new GoogleReauthError("구글 권한이 만료됐습니다.");
  }
  if (status === 403 && JSON.stringify(data ?? "").includes("insufficientPermissions")) {
    return new GoogleReauthError("구글 캘린더 권한이 부족합니다.");
  }
  return new GoogleApiError(e.message ?? "구글 캘린더 호출 실패", status);
}
