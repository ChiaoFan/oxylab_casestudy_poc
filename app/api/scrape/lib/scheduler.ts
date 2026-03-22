import cron, { ScheduledTask } from "node-cron";
import { readAutoScrapingEnabled } from "./settings";
import { scrapeAndPersist } from "../route";

type SchedulerState = {
  isInitialized: boolean;
  isRunning: boolean;
  lastRunTime: string | null;
  nextRunTime: string | null;
  lastError: string | null;
  task: ScheduledTask | null;
};

// Use globalThis to persist state across hot-reloads in development
declare global {
  var schedulerState: SchedulerState | undefined;
}

const state: SchedulerState = global.schedulerState ?? {
  isInitialized: false,
  isRunning: false,
  lastRunTime: null,
  nextRunTime: null,
  lastError: null,
  task: null,
};

// Persist to globalThis
global.schedulerState = state;

function calculateNextRunTime(): string {
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setMinutes(0, 0, 0);
  if (nextRun.getTime() <= now.getTime()) {
    nextRun.setHours(nextRun.getHours() + 1);
  }

  return nextRun.toISOString();
}

async function executeScrape() {
  try {
    const enabled = await readAutoScrapingEnabled();
    if (!enabled) {
      console.log("[Scheduler] Auto-scraping disabled, skipping run");
      return;
    }

    state.isRunning = true;
    console.log("[Scheduler] Starting scrape at", new Date().toISOString());

    const result = await scrapeAndPersist();

    state.lastRunTime = new Date().toISOString();
    state.lastError = null;
    console.log("[Scheduler] Scrape completed successfully", {
        timestamp: state.lastRunTime,
      productsCount: result.products.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    state.lastError = message;
    console.error("[Scheduler] Scrape error:", message);
  } finally {
    state.isRunning = false;
    state.nextRunTime = calculateNextRunTime();
  }
}

export function initScheduler() {
  // Clean up any existing task first (handles hot-reload in development)
  if (state.task) {
    state.task.stop();
    state.task = null;
    state.isInitialized = false;
  }

  if (state.isInitialized) {
    console.log("[Scheduler] Already initialized");
    return;
  }

  console.log("[Scheduler] Initializing with hourly cron job (0 * * * *) at", new Date().toISOString());

  // Run at the start of every hour
  state.task = cron.schedule("0 * * * *", executeScrape);

  state.isInitialized = true;
  state.nextRunTime = calculateNextRunTime();
  console.log("[Scheduler] Ready at", new Date().toISOString(), "Next scheduled run:", state.nextRunTime);
}

export async function getSchedulerStatus() {
  const enabled = await readAutoScrapingEnabled();
  const now = new Date();

  return {
    enabled,
    isInitialized: state.isInitialized,
    isRunning: state.isRunning,
    lastRunTime: state.lastRunTime,
    nextRunTime: state.nextRunTime,
    lastError: state.lastError,
    currentTime: now.toISOString(),
  };
}

export function stopScheduler() {
  if (state.task) {
    state.task.stop();
    state.task = null;
    state.isInitialized = false;
    console.log("[Scheduler] Stopped");
  }
}
