import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { scrapeNewsArticles, scrapeXPosts } from "@/lib/apify";
import { logger } from "@/lib/logger";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    // Validate secret to prevent unauthorized scraping triggers
    if (!isAuthorizedCronRequest(request, "api/scrape")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = (await request.json().catch(() => ({}))) as { type?: string };
    const type = body.type ?? "all";
    logger.info("api/scrape", "Scrape requested", { type });

    const results = { newsCount: 0, socialCount: 0, errors: [] as string[] };

    if (type === "all" || type === "news") {
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
          results.newsCount++;
        }
        logger.info("api/scrape", "News persisted", { count: results.newsCount });
      } catch (err) {
        logger.error("api/scrape", "News scraping failed", {
          message: (err as Error).message,
        });
        results.errors.push(
          process.env.NODE_ENV !== "production"
            ? `News scraping failed: ${(err as Error).message}`
            : "News scraping failed"
        );
      }
    }

    if (type === "all" || type === "social") {
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
          results.socialCount++;
        }
        logger.info("api/scrape", "Social persisted", { count: results.socialCount });
      } catch (err) {
        logger.error("api/scrape", "Social scraping failed", {
          message: (err as Error).message,
        });
        results.errors.push(
          process.env.NODE_ENV !== "production"
            ? `Social scraping failed: ${(err as Error).message}`
            : "Social scraping failed"
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scraped ${results.newsCount} news articles and ${results.socialCount} social posts`,
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
