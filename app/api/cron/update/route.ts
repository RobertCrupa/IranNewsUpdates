import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import SituationUpdate from "@/lib/models/SituationUpdate";
import { scrapeNewsArticles, scrapeXPosts } from "@/lib/apify";
import { generateSituationSummary } from "@/lib/openai";
import { logger } from "@/lib/logger";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

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
  const startedAt = Date.now();
  logger.info("api/cron/update", "Cron update started");

  if (!isAuthorizedCronRequest(request, "api/cron/update")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
  } catch (err) {
    logger.error("api/cron/update", "Database connection failed", {
      message: (err as Error).message,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "Database connection failed",
        ...(process.env.NODE_ENV !== "production" && {
          details: (err as Error).message,
        }),
      },
      { status: 500 }
    );
  }

  const errors: string[] = [];
  let newsCount = 0;
  let socialCount = 0;

  // --- Step 1: Scrape ---
  try {
    logger.info("api/cron/update", "Scraping news articles");
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
    logger.info("api/cron/update", "News scrape persisted", { count: newsCount });
  } catch (err) {
    logger.error("api/cron/update", "News scraping failed", {
      message: (err as Error).message,
    });
    errors.push(
      process.env.NODE_ENV !== "production"
        ? `News scraping failed: ${(err as Error).message}`
        : "News scraping failed"
    );
  }

  try {
    logger.info("api/cron/update", "Scraping social posts");
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
    logger.info("api/cron/update", "Social scrape persisted", { count: socialCount });
  } catch (err) {
    logger.error("api/cron/update", "Social scraping failed", {
      message: (err as Error).message,
    });
    errors.push(
      process.env.NODE_ENV !== "production"
        ? `Social scraping failed: ${(err as Error).message}`
        : "Social scraping failed"
    );
  }

  if (newsCount === 0 && socialCount === 0) {
    logger.warn("api/cron/update", "No items scraped from any source", {
      errors,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Scraping failed for all sources",
        newsCount,
        socialCount,
        errors,
      },
      { status: 502 }
    );
  }

  // --- Step 2: Generate situation update ---
  const fifteenMinutesAgo = new Date(Date.now() - CRON_INTERVAL_MS);
  let recentArticles: Array<{
    _id: unknown;
    title: string;
    source: string;
    content: string;
    publishedAt: Date;
  }> = [];

  try {
    recentArticles = await Article.find({
      scrapedAt: { $gte: fifteenMinutesAgo },
    })
      .sort({ publishedAt: -1 })
      .limit(20)
      .lean();
  } catch (err) {
    logger.error("api/cron/update", "Failed querying recent articles", {
      message: (err as Error).message,
      newsCount,
      socialCount,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "Failed querying recent articles",
        newsCount,
        socialCount,
        errors,
        ...(process.env.NODE_ENV !== "production" && {
          details: (err as Error).message,
        }),
      },
      { status: 500 }
    );
  }

  logger.info("api/cron/update", "Recent articles for summary", {
    count: recentArticles.length,
  });

  if (recentArticles.length === 0) {
    logger.warn("api/cron/update", "No recent articles found for summary", {
      newsCount,
      socialCount,
      durationMs: Date.now() - startedAt,
    });
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

  logger.info("api/cron/update", "Situation update generated and saved", {
    newsCount,
    socialCount,
    errorsCount: errors.length,
    severity: result.severity,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    success: true,
    message: `Scraped ${newsCount} news + ${socialCount} social articles and generated new situation update`,
    newsCount,
    socialCount,
    errors,
  });
}
