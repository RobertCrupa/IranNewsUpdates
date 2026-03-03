import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { scrapeXPosts } from "@/lib/apify";
import { logger } from "@/lib/logger";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { OFFICIAL_CATEGORIES, type OfficialCategory } from "@/lib/sources";

export const runtime = "nodejs";
export const maxDuration = 60;

function isOfficialCategory(value?: string): value is OfficialCategory {
  return OFFICIAL_CATEGORIES.includes(value as OfficialCategory);
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    // Validate secret to prevent unauthorized scraping triggers
    if (!isAuthorizedCronRequest(request, "api/scrape")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = (await request.json().catch(() => ({}))) as {
      type?: string;
      category?: string;
    };

    if (body.type === "news") {
      return NextResponse.json(
        { error: "News web scraping has been removed. Use official X account categories." },
        { status: 400 }
      );
    }

    const requestedType = body.type ?? "all";
    const requestedCategory = body.category;
    const category =
      requestedType !== "all" && isOfficialCategory(requestedType)
        ? requestedType
        : requestedCategory && isOfficialCategory(requestedCategory)
          ? requestedCategory
          : undefined;

    if (
      requestedType !== "all" &&
      requestedType !== "social" &&
      !isOfficialCategory(requestedType)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid scrape type. Use 'all', 'social', or one of: airline, government, civil-aviation, embassy.",
        },
        { status: 400 }
      );
    }

    logger.info("api/scrape", "Scrape requested", { requestedType, category: category ?? "all" });

    const results = {
      totalCount: 0,
      categoryCounts: Object.fromEntries(OFFICIAL_CATEGORIES.map((item) => [item, 0])) as Record<
        OfficialCategory,
        number
      >,
      errors: [] as string[],
    };

    try {
      const posts = await scrapeXPosts(category);
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
        results.categoryCounts[post.category] += 1;
        results.totalCount += 1;
      }
      logger.info("api/scrape", "Official X posts persisted", {
        totalCount: results.totalCount,
        categoryCounts: results.categoryCounts,
      });
    } catch (err) {
      logger.error("api/scrape", "Official X scraping failed", {
        message: (err as Error).message,
      });
      results.errors.push(
        process.env.NODE_ENV !== "production"
          ? `Official X scraping failed: ${(err as Error).message}`
          : "Official X scraping failed"
      );
    }

    return NextResponse.json({
      success: true,
      message: `Scraped ${results.totalCount} official X updates`,
      durationMs: Date.now() - startedAt,
      ...results,
    });
  } catch (err) {
    logger.error("api/scrape", "Scrape error", {
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
