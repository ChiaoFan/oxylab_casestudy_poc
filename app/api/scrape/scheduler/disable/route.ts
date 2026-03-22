import { NextResponse } from "next/server";
import { writeAutoScrapingEnabled } from "../../lib/settings";
import { stopScheduler } from "../../lib/scheduler";

export async function POST() {
  try {
    await writeAutoScrapingEnabled(false);
    stopScheduler();

    return NextResponse.json(
      { success: true, message: "Hourly scraping disabled" },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Disable scheduler error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
