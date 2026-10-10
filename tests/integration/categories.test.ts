import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { bearer, createTestContext, db, loginDemo, type TestContext } from "./context.js";
import { resetDb } from "./db.js";

let ctx: TestContext;
let token: string;

beforeEach(async () => {
  await resetDb(db);
  ctx = createTestContext();
  token = await loginDemo(ctx.app);
});
afterAll(() => db.$disconnect());

const post = (body: object) =>
  request(ctx.app).post("/v1/categories").set(bearer(token)).send(body);

describe("카테고리 API", () => {
  it("만들면 201, 색을 고르지 않으면 팔레트에서 아직 안 쓴 색을 준다", async () => {
    const first = await post({ name: "지능HCI" });
    const chosen = await post({ name: "DB", color: "#123abc" });
    const third = await post({ name: "알바" });

    expect(first.status).toBe(201);
    expect(first.body).toEqual({ id: expect.any(String), name: "지능HCI", color: "#F2C94C" });
    expect(chosen.body.color).toBe("#123ABC");
    expect(third.body.color).toBe("#EB5757");

    const list = await request(ctx.app).get("/v1/categories").set(bearer(token));
    expect(list.body.map((c: { name: string }) => c.name)).toEqual(["지능HCI", "DB", "알바"]);
  });

  it("같은 이름은 400", async () => {
    await post({ name: "지능HCI" });
    const res = await post({ name: " 지능HCI " });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("색을 바꾼다. 형식이 틀리면 400, 다른 사용자의 카테고리는 404", async () => {
    const { body: category } = await post({ name: "지능HCI" });
    const patch = (id: string, body: object, as = token) =>
      request(ctx.app).patch(`/v1/categories/${id}`).set(bearer(as)).send(body);

    expect((await patch(category.id, { color: "#00ff00" })).body.color).toBe("#00FF00");
    expect((await patch(category.id, { color: "green" })).status).toBe(400);
    const other = await loginDemo(ctx.app);
    expect((await patch(category.id, { color: "#000000" }, other)).status).toBe(404);
  });

  it("일정에 쓴 카테고리의 색이 일정 응답에 나온다", async () => {
    const { body: category } = await post({ name: "지능HCI", color: "#9B51E0" });
    const res = await request(ctx.app).post("/v1/events").set(bearer(token)).send({
      title: "[지능HCI] 회의",
      start: "2026-10-21T15:00:00+09:00",
      end: "2026-10-21T16:00:00+09:00",
      allDay: false,
    });

    expect(res.body.category).toEqual({ id: category.id, name: "지능HCI", color: "#9B51E0" });
  });
});
