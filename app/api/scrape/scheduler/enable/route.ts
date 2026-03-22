import { NextResponse } from "next/server";
import { writeAutoScrapingEnabled } from "../../lib/settings";
import { initScheduler } from "../../lib/scheduler";

export async function POST() {
  try {
    await writeAutoScrapingEnabled(true);
    initScheduler();

    return NextResponse.json(
      { success: true, message: "Hourly scraping enabled" },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Enable scheduler error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
