// 제목 규칙 `[카테고리] 일정 제목`. 근거: docs/api-draft.md '제목 규칙'

export interface ParsedTitle {
  category: string | null;
  title: string;
}

const CATEGORY_PREFIX = /^\s*\[([^\]]*)\]/;

/** 제목 맨 앞의 `[...]` 하나만 카테고리로 떼어 낸다. 비어 있으면 카테고리가 없다. */
export function parseTitle(raw: string): ParsedTitle {
  const match = CATEGORY_PREFIX.exec(raw);
  if (!match) {
    return { category: null, title: raw.trim() };
  }
  const category = (match[1] ?? "").trim();
  return {
    category: category === "" ? null : category,
    title: raw.slice(match[0].length).trim(),
  };
}

/** 구글 캘린더에 쓸 제목을 만든다. */
export function formatTitle({ category, title }: ParsedTitle): string {
  if (!category) {
    return title;
  }
  return title ? `[${category}] ${title}` : `[${category}]`;
}
