import { Agent, run } from "@openai/agents";
import { z } from "zod";

export interface ArticleContext {
  title: string;
  source: string;
  content: string;
  publishedAt: string;
}

export interface SituationSummaryResult {
  title: string;
  summary: string;
  keyPoints: string[];
  severity: "low" | "medium" | "high" | "critical";
}

const situationSummarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

const situationSummaryAgent = new Agent({
  name: "IranSituationSummarizer",
  model: process.env.OPENAI_SUMMARY_MODEL ?? "gpt-5-mini",
  instructions: `You are an expert news analyst covering the Iran conflict and Middle East situation.

Produce a factual, neutral, concise situation update from provided articles.
Use only information present in the provided source content.
Summary should be 2-3 short paragraphs and prioritize verifiable developments.
Always provide exactly 5 key points.

Severity guide:
- low = minor developments
- medium = significant escalation
- high = major conflict
- critical = imminent danger`,
  outputType: situationSummarySchema,
});

function assertOpenAIKey(): void {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Please define the OPENAI_API_KEY environment variable");
}

/**
 * Uses an LLM to generate a situation summary from a list of recent articles.
 */
export async function generateSituationSummary(
  articles: ArticleContext[]
): Promise<SituationSummaryResult> {
  assertOpenAIKey();

  const articlesText = articles
    .slice(0, 20)
    .map(
      (a, i) =>
        `[${i + 1}] Source: ${a.source}\nTitle: ${a.title}\nDate: ${a.publishedAt}\n${a.content}`
    )
    .join("\n\n---\n\n");

  const prompt = `Based on the following recent news articles, provide a comprehensive situation update.

ARTICLES:
${articlesText}

Return structured output with:
- title: "Hourly Situation Update: [brief descriptive title]"
- summary
- keyPoints (exactly 5 items)
- severity`;

  const result = await run(situationSummaryAgent, prompt, {
    context: {
      articleCount: Math.min(articles.length, 20),
      generatedAt: new Date().toISOString(),
    },
  });

  if (!result.finalOutput) throw new Error("No response from OpenAI agent");

  const parsed = situationSummarySchema.safeParse(result.finalOutput);
  if (!parsed.success) {
    throw new Error(`Invalid structured output from OpenAI agent: ${parsed.error.message}`);
  }

  return parsed.data;
}
