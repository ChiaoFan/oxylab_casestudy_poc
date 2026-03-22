import { NextResponse } from "next/server";
import { initOxylabsSchedulerSync } from "../scrape/system/service";

let initialized = false;

export async function GET() {
  try {
    if (!initialized) {
      initOxylabsSchedulerSync();
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
