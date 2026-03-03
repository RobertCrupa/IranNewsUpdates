import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SituationUpdate from "@/lib/models/SituationUpdate";
import Article from "@/lib/models/Article";
import { generateSituationSummary } from "@/lib/openai";
import { logger } from "@/lib/logger";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const startedAt = Date.now();
  try {
    await connectDB();

    const updates = await SituationUpdate.find()
      .sort({ generatedAt: -1 })
      .limit(10)
      .lean();

    logger.info("api/updates", "Fetched updates", {
      count: updates.length,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ updates });
  } catch (err) {
    logger.error("api/updates", "Updates fetch error", {
      message: (err as Error).message,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        ...(process.env.NODE_ENV !== "production" && { details: (err as Error).message }),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!isAuthorizedCronRequest(request, "api/updates")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // Get the most recent articles from the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentArticles = await Article.find({
      scrapedAt: { $gte: twoHoursAgo },
    })
      .sort({ publishedAt: -1 })
      .limit(20)
      .lean();

    logger.info("api/updates", "Recent articles selected for generation", {
      count: recentArticles.length,
    });

    if (recentArticles.length === 0) {
      logger.warn("api/updates", "No recent articles found for generation");
      return NextResponse.json(
        { error: "No recent articles found to generate update from" },
        { status: 400 }
      );
    }

    const articleContexts = recentArticles.map((a) => ({
      title: a.title,
      source: a.source,
      content: a.content,
      publishedAt: a.publishedAt.toISOString(),
    }));

    const result = await generateSituationSummary(articleContexts);

    const update = await SituationUpdate.create({
      title: result.title,
      summary: result.summary,
      keyPoints: result.keyPoints,
      severity: result.severity,
      generatedAt: new Date(),
      sourceArticleIds: recentArticles.map((a) => a._id),
    });

    logger.info("api/updates", "Generated and stored update", {
      severity: update.severity,
      keyPoints: update.keyPoints.length,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ success: true, update });
  } catch (err) {
    logger.error("api/updates", "Update generation error", {
      message: (err as Error).message,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        error: "Internal server error",
        ...(process.env.NODE_ENV !== "production" && { details: (err as Error).message }),
      },
      { status: 500 }
    );
  }
}
