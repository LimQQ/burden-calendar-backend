// 자연어 일정 해석: 규칙으로 먼저 풀고, 날짜·시작 시각·제목을 못 찾았을 때만 LLM에 묻는다.
// LLM이 없거나 실패하면 규칙 결과를 그대로 돌려준다.

import type { Logger } from "pino";
import type { Db } from "../db.js";
import { todayInSeoul } from "../events/time.js";
import { buildResult } from "./draft.js";
import { mergeParts, type NlpModel, partsFromLlm } from "./llm.js";
import { parseWithRules } from "./rules.js";
import type { ParseContext, ParseResult } from "./types.js";

/** 시작 설정 전 사용자의 활동 시간 (prisma/schema.prisma Profile 기본값과 같다) */
const DEFAULT_ACTIVE = { activeStart: "09:00", activeEnd: "22:00" };

export interface NlpServiceDeps {
  db: Db;
  /** LLM 설정이 없으면 null (규칙만 쓴다) */
  nlpModel: NlpModel | null;
  logger: Logger;
}

export type NlpService = ReturnType<typeof createNlpService>;

export function createNlpService({ db, nlpModel, logger }: NlpServiceDeps) {
  async function contextFor(userId: string, now: Date): Promise<ParseContext> {
    const [profile, categories] = await Promise.all([
      db.profile.findUnique({ where: { userId } }),
      db.category.findMany({ where: { userId }, select: { name: true } }),
    ]);
    return {
      today: todayInSeoul(now),
      activeStart: profile?.activeStart ?? DEFAULT_ACTIVE.activeStart,
      activeEnd: profile?.activeEnd ?? DEFAULT_ACTIVE.activeEnd,
      categories: categories.map((category) => category.name),
    };
  }

  return {
    async parse(userId: string, text: string, now: Date = new Date()): Promise<ParseResult> {
      const ctx = await contextFor(userId, now);
      const rule = parseWithRules(text, ctx);
      const ruleResult = buildResult(rule.parts, { assumptions: rule.assumptions, source: "rule" });
      if (!nlpModel || !needsLlm(ruleResult)) {
        return ruleResult;
      }

      try {
        const llm = partsFromLlm(await nlpModel.parse(text, ctx));
        if (!llm) {
          logger.warn("LLM 응답 형식이 맞지 않아 규칙 결과를 씁니다.");
          return ruleResult;
        }
        const assumptions = [...new Set([...rule.assumptions, ...llm.assumptions])];
        return buildResult(mergeParts(rule.parts, llm), { assumptions, source: "llm" });
      } catch (err) {
        logger.warn({ err }, "LLM 해석에 실패해 규칙 결과를 씁니다.");
        return ruleResult;
      }
    },
  };
}

/** 끝 시각만 빈 것은 사용자가 바로 고르면 되니 LLM을 부르지 않는다. */
function needsLlm(result: ParseResult): boolean {
  return result.missingFields.some((field) => field !== "endTime");
}
