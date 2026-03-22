import { NextResponse } from "next/server";
import { getSchedulerStatus } from "../../lib/scheduler";

export async function GET() {
  try {
    const status = await getSchedulerStatus();
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Get scheduler status error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
