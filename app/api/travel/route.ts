import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import TravelAlert from "@/lib/models/TravelAlert";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();

    const alerts = await TravelAlert.find({ isActive: true })
      .sort({ alertLevel: -1, updatedAt: -1 })
      .lean();

    return NextResponse.json({ alerts });
  } catch (err) {
    console.error("Travel alerts fetch error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: (err as Error).message },
      { status: 500 }
    );
  }
}
