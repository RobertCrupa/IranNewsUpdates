import { ApifyClient } from "apify-client";

export interface ScrapedArticle {
  title: string;
  url: string;
  source: string;
  content: string;
  publishedAt: string;
  imageUrl?: string;
}

function getApifyClient(): ApifyClient {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("Please define the APIFY_API_TOKEN environment variable");
  return new ApifyClient({ token });
}

/**
 * Scrapes news articles from trusted sources about the Iran situation
 * using the Apify Web Scraper actor.
 */
export async function scrapeNewsArticles(): Promise<ScrapedArticle[]> {
  const apifyClient = getApifyClient();
  const pendingRun = await apifyClient.actor("apify/web-scraper").start({
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
  const run = await apifyClient.run(pendingRun.id).waitForFinish({ waitSecs: 55 });
  if (run.status !== "SUCCEEDED") {
    throw new Error(`News scraper run did not finish in time (status: ${run.status})`);
  }
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
  return (items as unknown as ScrapedArticle[]).filter(Boolean);
}

/**
 * Scrapes X (Twitter) for latest Iran-related posts.
 * Uses the Apify Tweet Scraper actor.
 */
export async function scrapeXPosts(): Promise<ScrapedArticle[]> {
  const apifyClient = getApifyClient();
  const pendingRun = await apifyClient.actor("apidojo/tweet-scraper").start({
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
  const run = await apifyClient.run(pendingRun.id).waitForFinish({ waitSecs: 55 });
  if (run.status !== "SUCCEEDED") {
    throw new Error(`Social scraper run did not finish in time (status: ${run.status})`);
  }
  const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();

  return items
    .filter((item: Record<string, unknown>) => item && (item.full_text || item.text))
    .map((item: Record<string, unknown>) => ({
      title: ((item.full_text as string) || (item.text as string) || "").slice(0, 100),
      url: item.url as string || `https://x.com/i/web/status/${item.id as string}`,
      source: "x.com",
      content: (item.full_text as string) || (item.text as string) || "",
      publishedAt: (item.created_at as string) || new Date().toISOString(),
    }));
}
