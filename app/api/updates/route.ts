import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SituationUpdate from "@/lib/models/SituationUpdate";
import Article from "@/lib/models/Article";
import { generateSituationSummary } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    await connectDB();

    const updates = await SituationUpdate.find()
      .sort({ generatedAt: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({ updates });
  } catch (err) {
    console.error("Updates fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    if (recentArticles.length === 0) {
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

    return NextResponse.json({ success: true, update });
  } catch (err) {
    console.error("Update generation error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
