import OpenAI from "openai";

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

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Please define the OPENAI_API_KEY environment variable");
  return new OpenAI({ apiKey });
}

/**
 * Uses an LLM to generate a situation summary from a list of recent articles.
 */
export async function generateSituationSummary(
  articles: ArticleContext[]
): Promise<SituationSummaryResult> {
  const openai = getOpenAIClient();
  const articlesText = articles
    .slice(0, 20)
    .map(
      (a, i) =>
        `[${i + 1}] Source: ${a.source}\nTitle: ${a.title}\nDate: ${a.publishedAt}\n${a.content}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are an expert news analyst covering the Iran conflict and Middle East situation.

Based on the following recent news articles, provide a comprehensive situation update.

ARTICLES:
${articlesText}

Respond ONLY with a valid JSON object in this exact format:
{
  "title": "Hourly Situation Update: [brief descriptive title]",
  "summary": "A clear, factual 2-3 paragraph summary of the current situation",
  "keyPoints": [
    "Key development 1",
    "Key development 2",
    "Key development 3",
    "Key development 4",
    "Key development 5"
  ],
  "severity": "low|medium|high|critical"
}

Severity guide: low=minor developments, medium=significant escalation, high=major conflict, critical=imminent danger.
Be factual, neutral, and concise. Focus on verified information from the sources provided.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 1000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("No response from OpenAI");

  return JSON.parse(content) as SituationSummaryResult;
}
