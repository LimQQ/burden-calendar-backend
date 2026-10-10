// 일정 조회·생성·수정·삭제와 구글 캘린더 동기화.
// 실제 사용자는 구글에 먼저 쓰고 성공하면 DB에 반영한다. 데모 사용자는 DB에만 쓴다.

import type { TokenCipher } from "../auth/token-cipher.js";
import type { Db } from "../db.js";
import { ApiError } from "../errors.js";
import type { Category } from "../generated/prisma/client.js";
import {
  type GoogleCalendar,
  type GoogleCalendarFactory,
  GoogleApiError,
  GoogleReauthError,
} from "../google/calendar.js";
import { ensureCategory } from "./categories.js";
import { type FixedValues, resolveClassification } from "./classify.js";
import type { EventRow } from "./dto.js";
import { dateRange, formatEventTimes, fromStorage, parseEventTimes, toStorage } from "./time.js";
import { formatTitle, type ParsedTitle, parseTitle } from "./title.js";
import type { EventType } from "./types.js";

export interface EventInput {
  category?: string | null | undefined;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string | null | undefined;
  type?: EventType | null | undefined;
  important?: boolean | undefined;
  isDeadline?: boolean | null | undefined;
}

export interface EventPatch extends Partial<EventInput> {
  completed?: boolean | undefined;
  prepHours?: number | null | undefined;
}

export interface SyncResult {
  fetched: number;
  upserted: number;
  deleted: number;
}

export interface EventServiceDeps {
  db: Db;
  /** 구글 OAuth 설정이 없으면 null */
  calendarFor: GoogleCalendarFactory | null;
  tokenCipher: TokenCipher;
}

export type EventService = ReturnType<typeof createEventService>;

export function createEventService({ db, calendarFor, tokenCipher }: EventServiceDeps) {
  /** 그 사용자의 구글 캘린더. 데모 사용자는 null. */
  async function googleFor(userId: string): Promise<GoogleCalendar | null> {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { googleCredential: true },
    });
    if (!user) {
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "사용자를 찾을 수 없습니다. 다시 로그인해 주세요.",
      );
    }
    if (user.isDemo) {
      return null;
    }
    if (!calendarFor) {
      throw new ApiError(503, "GOOGLE_NOT_CONFIGURED", "서버에 구글 연동이 설정되지 않았습니다.");
    }
    if (!user.googleCredential) {
      throw reauthRequired();
    }
    let refreshToken: string;
    try {
      refreshToken = tokenCipher.decrypt(user.googleCredential.refreshTokenEnc);
    } catch (err) {
      // 암호화 키가 바뀐 경우. 다시 로그인하면 새 키로 저장된다.
      throw reauthRequired(err);
    }
    return calendarFor(refreshToken);
  }

  async function findOwned(userId: string, id: string): Promise<EventRow> {
    const row = await db.event.findFirst({ where: { id, userId }, include: { category: true } });
    if (!row) {
      throw new ApiError(404, "NOT_FOUND", "일정을 찾을 수 없습니다.");
    }
    return row;
  }

  async function categoryId(userId: string, name: string | null): Promise<string | null> {
    return name ? (await ensureCategory(db, userId, name)).id : null;
  }

  return {
    async list(userId: string, from: string, to: string): Promise<EventRow[]> {
      return db.event.findMany({
        where: { userId, ...overlapping(dateRange(from, to)) },
        include: { category: true },
        orderBy: [{ startAt: "asc" }, { id: "asc" }],
      });
    },

    async create(userId: string, input: EventInput): Promise<EventRow> {
      const text = resolveTitle(input, null);
      const times = parseEventTimes(input.allDay, input.start, input.end);
      const location = normalizeText(input.location);
      const classification = resolveClassification(text, {
        type: input.type ?? undefined,
        isDeadline: input.isDeadline ?? undefined,
      });

      const google = await googleFor(userId);
      const remote = google
        ? await withGoogle(() => google.insert({ summary: formatTitle(text), location, times }))
        : null;

      return db.event.create({
        data: {
          userId,
          googleEventId: remote?.googleEventId ?? null,
          calendarId: remote ? "primary" : null,
          title: text.title,
          categoryId: await categoryId(userId, text.category),
          ...toStorage(times),
          location,
          ...classification,
          important: input.important ?? false,
        },
        include: { category: true },
      });
    },

    async update(userId: string, id: string, patch: EventPatch): Promise<EventRow> {
      const row = await findOwned(userId, id);
      const currentText: ParsedTitle = { category: row.category?.name ?? null, title: row.title };
      const text =
        patch.title !== undefined || patch.category !== undefined
          ? resolveTitle(
              { category: patch.category, title: patch.title ?? row.title },
              currentText.category,
            )
          : currentText;

      const timesChanged =
        patch.allDay !== undefined || patch.start !== undefined || patch.end !== undefined;
      let times = fromStorage(row);
      if (timesChanged) {
        const current = formatEventTimes(times);
        times = parseEventTimes(
          patch.allDay ?? row.allDay,
          patch.start ?? current.start,
          patch.end ?? current.end,
        );
      }
      const location = patch.location !== undefined ? normalizeText(patch.location) : row.location;

      // 보낸 값은 사용자 지정으로 고정하고, null은 규칙으로 되돌린다.
      const fixed = fixedFromRow(row);
      if (patch.type !== undefined) {
        fixed.type = patch.type ?? undefined;
      }
      if (patch.isDeadline !== undefined) {
        fixed.isDeadline = patch.isDeadline ?? undefined;
      }
      if (patch.prepHours !== undefined) {
        fixed.prepHours = patch.prepHours ?? undefined;
      }
      const classification = resolveClassification(text, fixed);

      const completedAt =
        patch.completed === undefined
          ? row.completedAt
          : patch.completed
            ? (row.completedAt ?? new Date())
            : null;

      const titleChanged = formatTitle(text) !== formatTitle(currentText);
      const locationChanged = location !== row.location;
      const { googleEventId } = row;
      if (googleEventId && (titleChanged || timesChanged || locationChanged)) {
        const google = await googleFor(userId);
        if (google) {
          await withGoogle(() =>
            google.patch(googleEventId, {
              ...(titleChanged && { summary: formatTitle(text) }),
              ...(timesChanged && { times }),
              ...(locationChanged && { location }),
            }),
          );
        }
      }

      return db.event.update({
        where: { id: row.id },
        data: {
          title: text.title,
          categoryId: await categoryId(userId, text.category),
          ...toStorage(times),
          location,
          ...classification,
          important: patch.important ?? row.important,
          completedAt,
        },
        include: { category: true },
      });
    },

    async remove(userId: string, id: string): Promise<void> {
      const row = await findOwned(userId, id);
      const { googleEventId } = row;
      if (googleEventId) {
        const google = await googleFor(userId);
        if (google) {
          await withGoogle(() => google.remove(googleEventId));
        }
      }
      await db.event.delete({ where: { id: row.id } });
    },

    /** 기간 안의 구글 일정을 DB에 맞춘다. 앱에만 있는 정보(완료·중요·사용자 지정 값)는 지키고, 구글에서 사라진 일정은 지운다. */
    async sync(userId: string, from: string, to: string): Promise<SyncResult> {
      const google = await googleFor(userId);
      if (!google) {
        return { fetched: 0, upserted: 0, deleted: 0 };
      }
      const range = dateRange(from, to);
      const remote = await withGoogle(() => google.list(range.start, range.end));
      const remoteIds = remote.map((event) => event.googleEventId);

      const existing = await db.event.findMany({
        where: { userId, googleEventId: { in: remoteIds } },
        include: { category: true },
      });
      const byGoogleId = new Map(existing.map((row) => [row.googleEventId, row]));
      const categories = new Map<string, Category>();

      for (const event of remote) {
        const text = parseTitle(event.summary);
        let category: Category | null = null;
        if (text.category) {
          category =
            categories.get(text.category) ?? (await ensureCategory(db, userId, text.category));
          categories.set(text.category, category);
        }
        const row = byGoogleId.get(event.googleEventId);
        const data = {
          title: text.title,
          categoryId: category?.id ?? null,
          ...toStorage(event.times),
          location: event.location,
          ...resolveClassification(text, row ? fixedFromRow(row) : {}),
        };
        if (row) {
          await db.event.update({ where: { id: row.id }, data });
        } else {
          await db.event.create({
            data: { userId, googleEventId: event.googleEventId, calendarId: "primary", ...data },
          });
        }
      }

      const { count: deleted } = await db.event.deleteMany({
        where: { userId, googleEventId: { not: null, notIn: remoteIds }, ...overlapping(range) },
      });
      return { fetched: remote.length, upserted: remote.length, deleted };
    },
  };
}

/** category를 따로 보내면 그 값이 우선이다. 아니면 제목의 `[...]`을 떼고, 없으면 keepCategory를 쓴다. */
function resolveTitle(
  input: { category?: string | null | undefined; title: string },
  keepCategory: string | null,
): ParsedTitle {
  let text: ParsedTitle;
  if (input.category !== undefined) {
    text = { category: normalizeText(input.category), title: input.title.trim() };
  } else {
    const parsed = parseTitle(input.title);
    text = { category: parsed.category ?? keepCategory, title: parsed.title };
  }
  if (!text.title) {
    throw new ApiError(400, "VALIDATION_ERROR", "title: 일정 제목이 비어 있습니다.");
  }
  return text;
}

function fixedFromRow(row: EventRow): FixedValues {
  return {
    type: row.typeSource === "user" ? row.type : undefined,
    isDeadline: row.deadlineSource === "user" ? row.isDeadline : undefined,
    prepHours: row.prepHoursSource === "user" ? row.prepHours : undefined,
  };
}

/** 기간 [start, end)와 겹치는 일정. 길이가 0인 일정(시작 = 종료)도 포함한다. */
function overlapping(range: { start: Date; end: Date }) {
  return {
    startAt: { lt: range.end },
    OR: [{ endAt: { gt: range.start } }, { startAt: { gte: range.start } }],
  };
}

function normalizeText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function reauthRequired(cause?: unknown): ApiError {
  return new ApiError(401, "REAUTH_REQUIRED", "구글 권한이 만료됐습니다. 다시 로그인해 주세요.", {
    cause,
  });
}

async function withGoogle<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GoogleReauthError) {
      throw reauthRequired(err);
    }
    if (err instanceof GoogleApiError) {
      throw new ApiError(502, "GOOGLE_API_ERROR", "구글 캘린더에 반영하지 못했습니다.", {
        cause: err,
      });
    }
    throw err;
  }
}
