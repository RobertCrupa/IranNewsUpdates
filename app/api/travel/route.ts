import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import TravelAlert from "@/lib/models/TravelAlert";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  try {
    await connectDB();

    const alerts = await TravelAlert.aggregate([
      {
        $match: { isActive: true },
      },
      {
        $addFields: {
          severityRank: {
            $switch: {
              branches: [
                { case: { $eq: ["$alertLevel", "red"] }, then: 4 },
                { case: { $eq: ["$alertLevel", "amber"] }, then: 3 },
                { case: { $eq: ["$alertLevel", "yellow"] }, then: 2 },
                { case: { $eq: ["$alertLevel", "green"] }, then: 1 },
              ],
              default: 0,
            },
          },
        },
      },
      {
        $sort: { severityRank: -1, updatedAt: -1 },
      },
      {
        $project: { severityRank: 0 },
      },
    ]);

    logger.info("api/travel", "Fetched active travel alerts", {
      count: alerts.length,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ alerts });
  } catch (err) {
    logger.error("api/travel", "Travel alerts fetch error", {
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
