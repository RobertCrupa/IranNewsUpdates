import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import SituationUpdate from "@/lib/models/SituationUpdate";
import { scrapeXPosts } from "@/lib/apify";
import { generateSituationSummary } from "@/lib/openai";
import { logger } from "@/lib/logger";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { OFFICIAL_CATEGORIES } from "@/lib/sources";
import { Types } from "mongoose";

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
 *  1. Scrape fresh posts from official X accounts
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
  const categoryCounts = Object.fromEntries(OFFICIAL_CATEGORIES.map((category) => [category, 0])) as Record<
    (typeof OFFICIAL_CATEGORIES)[number],
    number
  >;
  let totalCount = 0;

  // --- Step 1: Scrape ---
  try {
    logger.info("api/cron/update", "Scraping official X posts");
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
          category: post.category,
          imageUrl: post.imageUrl,
          scrapedAt: new Date(),
        },
        { upsert: true, new: true }
      );
      categoryCounts[post.category] += 1;
      totalCount++;
    }
    logger.info("api/cron/update", "Official X posts persisted", {
      totalCount,
      categoryCounts,
    });
  } catch (err) {
    logger.error("api/cron/update", "Official X scraping failed", {
      message: (err as Error).message,
    });
    errors.push(
      process.env.NODE_ENV !== "production"
        ? `Official X scraping failed: ${(err as Error).message}`
        : "Official X scraping failed"
    );
  }

  if (totalCount === 0) {
    logger.warn("api/cron/update", "No items scraped from official accounts", {
      errors,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        success: false,
        message: "Scraping failed for all official accounts",
        totalCount,
        categoryCounts,
        errors,
      },
      { status: 502 }
    );
  }

  // --- Step 2: Generate situation update ---
  const fifteenMinutesAgo = new Date(Date.now() - CRON_INTERVAL_MS);
  let recentArticles: Array<{
    _id: Types.ObjectId;
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
      totalCount,
      categoryCounts,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "Failed querying recent articles",
        totalCount,
        categoryCounts,
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
      totalCount,
      categoryCounts,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({
      success: true,
      message: "Scraping complete but no new articles found for summary",
      totalCount,
      categoryCounts,
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
    totalCount,
    categoryCounts,
    errorsCount: errors.length,
    severity: result.severity,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    success: true,
    message: `Scraped ${totalCount} official X updates and generated new situation update`,
    totalCount,
    categoryCounts,
    errors,
  });
}
