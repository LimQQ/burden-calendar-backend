// Google Gemini API로 만든 NlpModel. 무료 등급에서는 입력이 구글 제품 개선에 쓰일 수 있다
// (User Study 동의서에 알릴 것).

import { GoogleGenAI } from "@google/genai";
import { buildPrompt, LLM_OUTPUT_SCHEMA, type NlpModel, SYSTEM_INSTRUCTION } from "./llm.js";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export interface GeminiConfig {
  apiKey: string;
  model?: string | undefined;
  /** 이 시간 안에 답이 없으면 규칙 결과를 쓴다. */
  timeoutMs?: number;
}

export function createGeminiModel({
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  timeoutMs = 8000,
}: GeminiConfig): NlpModel {
  const client = new GoogleGenAI({ apiKey });
  return {
    async parse(text, ctx) {
      const interaction = await client.interactions.create(
        {
          model,
          system_instruction: SYSTEM_INSTRUCTION,
          input: buildPrompt(text, ctx),
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: LLM_OUTPUT_SCHEMA,
          },
        },
        { timeout: timeoutMs, maxRetries: 0 },
      );
      if (!interaction.output_text) {
        throw new Error("Gemini가 빈 응답을 돌려줬습니다.");
      }
      return JSON.parse(interaction.output_text) as unknown;
    },
  };
}
