import { logger } from "@/lib/logger";
import {
  getOfficialAccounts,
  normalizeHandle,
  resolveCategoryFromHandle,
  type OfficialCategory,
} from "@/lib/sources";

export interface ScrapedArticle {
  title: string;
  url: string;
  source: string;
  content: string;
  publishedAt: string;
  category: OfficialCategory;
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

function inferHandleFromItem(item: Record<string, unknown>): string | null {
  const candidates = [
    item.userName,
    item.username,
    item.screen_name,
    (item.author as Record<string, unknown> | undefined)?.userName,
    (item.author as Record<string, unknown> | undefined)?.username,
    (item.author as Record<string, unknown> | undefined)?.screen_name,
    (item.user as Record<string, unknown> | undefined)?.userName,
    (item.user as Record<string, unknown> | undefined)?.username,
    (item.user as Record<string, unknown> | undefined)?.screen_name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeHandle(candidate);
    }
  }

  const url = typeof item.url === "string" ? item.url : "";
  const match = url.match(/x\.com\/([^/]+)\/status\//i);
  if (match?.[1]) {
    return normalizeHandle(match[1]);
  }

  return null;
}

function isOriginalPost(item: Record<string, unknown>): boolean {
  const retweet = Boolean(item.isRetweet ?? item.retweeted ?? item.is_repost ?? item.isRepost);
  const reply = Boolean(item.isReply ?? item.inReplyToStatusId ?? item.in_reply_to_status_id);
  const quote = Boolean(item.isQuote ?? item.isQuoteStatus ?? item.quoted_status_id);
  const text = String(item.full_text ?? item.text ?? "");
  return !retweet && !reply && !quote && !text.startsWith("RT @");
}

/**
 * Scrapes X (Twitter) for latest updates from configured official accounts.
 * Uses the Apify Tweet Scraper actor.
 */
export async function scrapeXPosts(category?: OfficialCategory): Promise<ScrapedArticle[]> {
  const accounts = getOfficialAccounts(category);
  const searchTerms = accounts.map((handle) => `from:${handle} -is:retweet -is:reply -is:quote`);

  const startedAt = Date.now();
  logger.info("apify/social", "Starting X scrape");
  const pendingRun = await startActorRun("apidojo/tweet-scraper", {
    searchTerms,
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
    .filter((item: Record<string, unknown>) => isOriginalPost(item))
    .map((item: Record<string, unknown>) => {
      const handle = inferHandleFromItem(item);
      const resolvedCategory = resolveCategoryFromHandle(handle);
      if (!resolvedCategory) return null;

      const source = handle ? `@${handle}` : "x.com";
      const content = ((item.full_text as string) || (item.text as string) || "").trim();

      return {
        title: content.slice(0, 100),
        url: (item.url as string) || `https://x.com/i/web/status/${item.id as string}`,
        source,
        content,
        publishedAt: (item.created_at as string) || new Date().toISOString(),
        category: resolvedCategory,
      };
    })
    .filter((item): item is ScrapedArticle => Boolean(item));

  logger.info("apify/social", "Social items collected", { count: mapped.length });
  return mapped;
}
