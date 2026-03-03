import { logger } from "@/lib/logger";

export interface ScrapedArticle {
  title: string;
  url: string;
  source: string;
  content: string;
  publishedAt: string;
  imageUrl?: string;
}

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
}

function getApifyToken(): string {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("Please define the APIFY_API_TOKEN environment variable");
  return token;
}

function actorPath(actorId: string): string {
  return actorId.replace("/", "~");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startActorRun(actorId: string, input: Record<string, unknown>): Promise<ApifyRun> {
  const token = getApifyToken();
  const url = `https://api.apify.com/v2/acts/${actorPath(actorId)}/runs?token=${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify start run failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const body = (await res.json()) as { data: ApifyRun };
  return body.data;
}

async function waitForRunFinish(runId: string, waitMs = 55_000): Promise<ApifyRun> {
  const token = getApifyToken();
  const started = Date.now();

  while (Date.now() - started < waitMs) {
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Apify run status failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const body = (await res.json()) as { data: ApifyRun };
    const run = body.data;
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
      return run;
    }

    await sleep(2000);
  }

  throw new Error("Apify run did not finish within timeout window");
}

async function getDatasetItems(datasetId: string): Promise<Record<string, unknown>[]> {
  const token = getApifyToken();
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true&format=json`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify dataset read failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return (await res.json()) as Record<string, unknown>[];
}

/**
 * Scrapes news articles from trusted sources about the Iran situation
 * using the Apify Web Scraper actor.
 */
export async function scrapeNewsArticles(): Promise<ScrapedArticle[]> {
  const startedAt = Date.now();
  logger.info("apify/news", "Starting news scrape");
  const pendingRun = await startActorRun("apify/web-scraper", {
    startUrls: [
      { url: "https://www.bbc.com/news/world/middle_east" },
      { url: "https://www.reuters.com/world/middle-east/" },
      { url: "https://apnews.com/hub/iran" },
      { url: "https://www.aljazeera.com/tag/iran/" },
    ],
    pseudoUrls: [
      "https://www.bbc.com/news/[.*]",
      "https://www.reuters.com/world/middle-east/[.*]",
      "https://apnews.com/article/[.*]",
      "https://www.aljazeera.com/news/[.*]",
    ],
    pageFunction: `async function pageFunction(context) {
      const { $, request, log } = context;
      const url = request.url;

      let title = $('h1').first().text().trim() || $('title').text().trim();
      let content = '';
      let publishedAt = new Date().toISOString();
      let imageUrl = $('meta[property="og:image"]').attr('content') || '';

      // Extract article body paragraphs
      $('article p, .article-body p, .story-body p, [data-testid="article-body"] p').each((_, el) => {
        content += $(el).text().trim() + ' ';
      });

      // Try to get published date
      const dateEl = $('time').first();
      if (dateEl.attr('datetime')) {
        publishedAt = dateEl.attr('datetime');
      } else {
        const metaDate = $('meta[property="article:published_time"]').attr('content')
          || $('meta[name="pubdate"]').attr('content');
        if (metaDate) publishedAt = metaDate;
      }

      const hostname = new URL(url).hostname.replace('www.', '');

      if (!title || title.length < 5) return null;

      return { title, url, source: hostname, content: content.trim().slice(0, 2000), publishedAt, imageUrl };
    }`,
    maxRequestsPerCrawl: 50,
    maxConcurrency: 5,
  });

  // Wait up to 55 s so the function stays within the 60 s serverless limit.
  const run = await waitForRunFinish(pendingRun.id, 55_000);
  logger.info("apify/news", "News actor finished", {
    runId: run.id,
    status: run.status,
    durationMs: Date.now() - startedAt,
  });
  if (run.status !== "SUCCEEDED") {
    throw new Error(`News scraper run did not finish in time (status: ${run.status})`);
  }
  const items = await getDatasetItems(run.defaultDatasetId);
  const mapped = (items as unknown as ScrapedArticle[]).filter(Boolean);
  logger.info("apify/news", "News items collected", { count: mapped.length });
  return mapped;
}

/**
 * Scrapes X (Twitter) for latest Iran-related posts.
 * Uses the Apify Tweet Scraper actor.
 */
export async function scrapeXPosts(): Promise<ScrapedArticle[]> {
  const startedAt = Date.now();
  logger.info("apify/social", "Starting X scrape");
  const pendingRun = await startActorRun("apidojo/tweet-scraper", {
    searchTerms: [
      "Iran war",
      "Iran attack",
      "Middle East conflict",
      "UAE stranded",
      "Iran Israel",
    ],
    maxTweets: 50,
    addUserInfo: false,
  });

  // Wait up to 55 s so the function stays within the 60 s serverless limit.
  const run = await waitForRunFinish(pendingRun.id, 55_000);
  logger.info("apify/social", "X actor finished", {
    runId: run.id,
    status: run.status,
    durationMs: Date.now() - startedAt,
  });
  if (run.status !== "SUCCEEDED") {
    throw new Error(`Social scraper run did not finish in time (status: ${run.status})`);
  }
  const items = await getDatasetItems(run.defaultDatasetId);

  const mapped = items
    .filter((item: Record<string, unknown>) => item && (item.full_text || item.text))
    .map((item: Record<string, unknown>) => ({
      title: ((item.full_text as string) || (item.text as string) || "").slice(0, 100),
      url: item.url as string || `https://x.com/i/web/status/${item.id as string}`,
      source: "x.com",
      content: (item.full_text as string) || (item.text as string) || "",
      publishedAt: (item.created_at as string) || new Date().toISOString(),
    }));

  logger.info("apify/social", "Social items collected", { count: mapped.length });
  return mapped;
}
