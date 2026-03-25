import { NextResponse } from "next/server";
import {
  disableOxylabsScheduler,
  enableOxylabsScheduler,
  getOxylabsSchedulerStatus,
  initOxylabsSchedulerSync,
} from "./service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ActionBody = {
  action?: unknown;
};

async function buildSystemResponse() {
  return {
    oxylabsScheduler: await getOxylabsSchedulerStatus(),
  };
}

export async function GET() {
  try {
    // Scheduler API endpoint: read current scheduler status for frontend.
    initOxylabsSchedulerSync();

    return NextResponse.json(await buildSystemResponse());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Scheduler API endpoint: enable or disable hourly scheduler from frontend controls.
    initOxylabsSchedulerSync();

    const body = (await request.json()) as ActionBody;

    switch (body.action) {
      case "enable_oxylabs_scheduler":
        await enableOxylabsScheduler();
        break;
      case "disable_oxylabs_scheduler":
        await disableOxylabsScheduler();
        break;
      default:
        return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    }

    return NextResponse.json(await buildSystemResponse());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
