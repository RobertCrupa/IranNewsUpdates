import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { logger } from "@/lib/logger";
import { OFFICIAL_CATEGORIES, type OfficialCategory } from "@/lib/sources";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const category = searchParams.get("category");
    const skip = (page - 1) * limit;

    const filter: Record<string, string | { $in: string[] }> = {};
    if (category && OFFICIAL_CATEGORIES.includes(category as OfficialCategory)) {
      filter.category = category;
    } else if (category === "social") {
      filter.category = { $in: [...OFFICIAL_CATEGORIES] };
    } else if (category === "news") {
      filter.category = "news";
    }

    logger.debug("api/news", "Fetching news", {
      page,
      limit,
      category: category ?? "all",
    });

    const [articles, total] = await Promise.all([
      Article.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Article.countDocuments(filter),
    ]);

    logger.info("api/news", "Fetched news", {
      count: articles.length,
      total,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error("api/news", "News fetch error", {
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
