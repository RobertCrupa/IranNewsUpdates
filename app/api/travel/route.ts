import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import TravelAlert from "@/lib/models/TravelAlert";

export const runtime = "nodejs";

export async function GET() {
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

    return NextResponse.json({ alerts });
  } catch (err) {
    console.error("Travel alerts fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
