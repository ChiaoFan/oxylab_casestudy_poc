import { NextResponse } from "next/server";
import { initScheduler } from "../scrape/lib/scheduler";
import { readAutoScrapingEnabled } from "../scrape/lib/settings";

let initialized = false;

export async function GET() {
  try {
    if (!initialized) {
      const enabled = await readAutoScrapingEnabled();
      if (enabled) {
        initScheduler();
      }
      initialized = true;
      console.log("[Health] Scheduler initialized on startup");
    }

    return NextResponse.json({ status: "ok", initialized: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Health] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
