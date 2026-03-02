import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import SituationUpdate from "@/lib/models/SituationUpdate";
import { scrapeNewsArticles, scrapeXPosts } from "@/lib/apify";
import { generateSituationSummary } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

// Must match the "*/15 * * * *" schedule in vercel.json
const CRON_INTERVAL_MS = 15 * 60 * 1000;

/**
 * GET /api/cron/update
 *
 * Called by Vercel Cron every 15 minutes.
 * Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` so the
 * endpoint rejects any unauthenticated request when CRON_SECRET is set.
 *
 * Steps:
 *  1. Scrape fresh articles from news sources and X
 *  2. Generate a new AI situation summary from the latest articles
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const errors: string[] = [];
  let newsCount = 0;
  let socialCount = 0;

  // --- Step 1: Scrape ---
  try {
    const articles = await scrapeNewsArticles();
    for (const article of articles) {
      await Article.findOneAndUpdate(
        { url: article.url },
        {
          title: article.title,
          url: article.url,
          source: article.source,
          content: article.content,
          publishedAt: new Date(article.publishedAt),
          category: "news",
          imageUrl: article.imageUrl,
          scrapedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      newsCount++;
    }
  } catch (err) {
    errors.push(`News scraping failed: ${(err as Error).message}`);
  }

  try {
    const posts = await scrapeXPosts();
    for (const post of posts) {
      await Article.findOneAndUpdate(
        { url: post.url },
        {
          title: post.title,
          url: post.url,
          source: post.source,
          content: post.content,
          publishedAt: new Date(post.publishedAt),
          category: "social",
          scrapedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      socialCount++;
    }
  } catch (err) {
    errors.push(`Social scraping failed: ${(err as Error).message}`);
  }

  // --- Step 2: Generate situation update ---
  const fifteenMinutesAgo = new Date(Date.now() - CRON_INTERVAL_MS);
  const recentArticles = await Article.find({
    scrapedAt: { $gte: fifteenMinutesAgo },
  })
    .sort({ publishedAt: -1 })
    .limit(20)
    .lean();

  if (recentArticles.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Scraping complete but no new articles found for summary",
      newsCount,
      socialCount,
      errors,
    });
  }

  const articleContexts = recentArticles.map((a) => ({
    title: a.title,
    source: a.source,
    content: a.content,
    publishedAt: a.publishedAt.toISOString(),
  }));

  const result = await generateSituationSummary(articleContexts);

  await SituationUpdate.create({
    title: result.title,
    summary: result.summary,
    keyPoints: result.keyPoints,
    severity: result.severity,
    generatedAt: new Date(),
    sourceArticleIds: recentArticles.map((a) => a._id),
  });

  return NextResponse.json({
    success: true,
    message: `Scraped ${newsCount} news + ${socialCount} social articles and generated new situation update`,
    newsCount,
    socialCount,
    errors,
  });
}
