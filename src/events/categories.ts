import type { Db } from "../db.js";
import type { Category } from "../generated/prisma/client.js";

/** 새 카테고리의 기본 색. 앞에서부터 아직 안 쓴 색을 준다. 사용자는 나중에 바꿀 수 있다. */
export const CATEGORY_PALETTE = [
  "#F2C94C",
  "#EB5757",
  "#2F80ED",
  "#27AE60",
  "#9B51E0",
  "#F2994A",
  "#56CCF2",
  "#6FCF97",
  "#BB6BD9",
  "#828282",
] as const;

export const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function categoryDto(category: Category): { id: string; name: string; color: string } {
  return { id: category.id, name: category.name, color: category.color };
}

export async function nextCategoryColor(db: Db, userId: string): Promise<string> {
  const used = await db.category.findMany({ where: { userId }, select: { color: true } });
  const usedColors = new Set(used.map((c) => c.color.toUpperCase()));
  return (
    CATEGORY_PALETTE.find((color) => !usedColors.has(color)) ??
    CATEGORY_PALETTE[used.length % CATEGORY_PALETTE.length]!
  );
}

/** 이름이 같은 카테고리가 있으면 그것을, 없으면 새로 만들어 돌려준다. */
export async function ensureCategory(db: Db, userId: string, name: string): Promise<Category> {
  const existing = await db.category.findUnique({ where: { userId_name: { userId, name } } });
  if (existing) {
    return existing;
  }
  const color = await nextCategoryColor(db, userId);
  return db.category.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, color },
    update: {},
  });
}
