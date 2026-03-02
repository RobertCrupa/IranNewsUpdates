import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Article from "@/lib/models/Article";
import { scrapeNewsArticles, scrapeXPosts } from "@/lib/apify";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Validate secret to prevent unauthorized scraping triggers
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = (await request.json().catch(() => ({}))) as { type?: string };
    const type = body.type ?? "all";

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
      } catch (err) {
        results.errors.push(`News scraping failed: ${(err as Error).message}`);
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
      } catch (err) {
        results.errors.push(`Social scraping failed: ${(err as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Scraped ${results.newsCount} news articles and ${results.socialCount} social posts`,
      ...results,
    });
  } catch (err) {
    console.error("Scrape error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
