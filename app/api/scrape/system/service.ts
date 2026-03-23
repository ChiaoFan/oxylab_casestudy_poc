import cron, { ScheduledTask } from "node-cron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scrapeAndPersistFromSearchResponse } from "../route";

export const DEFAULT_GEO_LOCATION = "90210";
const OUTPUT_DIR = join(process.cwd(), "output");
const SETTINGS_FILE = join(OUTPUT_DIR, "tecnovaai_settings.json");
const OXYLABS_SCHEDULES_URL = "https://data.oxylabs.io/v1/schedules";
const OXYLABS_QUERIES_URL = "https://data.oxylabs.io/v1/queries";
const OXYLABS_SCHEDULE_CRON = "0 * * * *";
const OXYLABS_SCHEDULE_LIFETIME_DAYS = 30;
const OXYLABS_SCHEDULE_QUERY = "iphone";
const OXYLABS_SYNC_CRON = "* * * * *";

type SettingsPayload = {
  geo_location: string | null;
  oxylabsSchedulerId: string | null;
  oxylabsSchedulerLastProcessedRunId: string | null;
};

type OxylabsSyncState = {
  isInitialized: boolean;
  isRunning: boolean;
  task: ScheduledTask | null;
};

type OxylabsScheduleResponse = {
  scheduleId: string;
  active: boolean;
  itemsCount: number | null;
  cron: string | null;
  endTime: string | null;
  nextRunAt: string | null;
};

type OxylabsScheduleRunJob = {
  id: string;
  createStatusCode: number | null;
  resultStatus: string | null;
  createdAt: string | null;
  resultCreatedAt: string | null;
};

type OxylabsScheduleRun = {
  runId: string;
  jobs: OxylabsScheduleRunJob[];
  successRate: number | null;
};

type OxylabsSchedulerStatus = {
  scheduleId: string | null;
  active: boolean | null;
  nextRunAt: string | null;
  isRunning: boolean;
};

declare global {
  var oxylabsSyncState: OxylabsSyncState | undefined;
}

const oxylabsSyncState: OxylabsSyncState = global.oxylabsSyncState ?? {
  isInitialized: false,
  isRunning: false,
  task: null,
};

global.oxylabsSyncState = oxylabsSyncState;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOxylabsAuthHeader() {
  const user = process.env.OXYLABS_USER;
  const pass = process.env.OXYLABS_PASS;

  if (!user || !pass) {
    throw new Error("Missing OXYLABS_USER or OXYLABS_PASS environment variables.");
  }

  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

function extractLargeNumericField(bodyText: string, fieldName: string): string | null {
  const match = bodyText.match(new RegExp(`"${fieldName}"\\s*:\\s*(\\d+)`));
  return match?.[1] ?? null;
}

function parseJsonWithStringifiedIds(bodyText: string): unknown {
  const normalized = bodyText.replace(/"(schedule_id|run_id|id)"\s*:\s*(\d+)/g, '"$1":"$2"');
  return normalized ? JSON.parse(normalized) : null;
}

function formatOxylabsDate(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}

function toIsoDate(value: string | null) {
  if (!value) return new Date().toISOString();
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function getOxylabsScheduleEndTime() {
  const end = new Date();
  end.setDate(end.getDate() + OXYLABS_SCHEDULE_LIFETIME_DAYS);
  end.setMinutes(0, 0, 0);
  return formatOxylabsDate(end);
}

async function readAllSettings(): Promise<SettingsPayload> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<SettingsPayload>;
    return {
      geo_location: "geo_location" in parsed ? normalizeGeoLocation(parsed.geo_location) : DEFAULT_GEO_LOCATION,
      oxylabsSchedulerId:
        typeof parsed.oxylabsSchedulerId === "string" && parsed.oxylabsSchedulerId.trim()
          ? parsed.oxylabsSchedulerId
          : null,
      oxylabsSchedulerLastProcessedRunId:
        typeof parsed.oxylabsSchedulerLastProcessedRunId === "string" && parsed.oxylabsSchedulerLastProcessedRunId.trim()
          ? parsed.oxylabsSchedulerLastProcessedRunId
          : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("ENOENT")) {
      return {
        geo_location: DEFAULT_GEO_LOCATION,
        oxylabsSchedulerId: null,
        oxylabsSchedulerLastProcessedRunId: null,
      };
    }
    throw error;
  }
}

async function writeAllSettings(payload: SettingsPayload) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(SETTINGS_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function normalizeGeoLocation(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("Geo-location must be a string or null.");
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  if (!/^\d{5}$/.test(trimmed)) {
    throw new Error("Geo-location must be null or a 5-digit ZIP code.");
  }

  const numeric = Number(trimmed);
  if (numeric < 501 || numeric > 99950) {
    throw new Error("Geo-location must be between 00501 and 99950.");
  }

  return trimmed;
}

export async function readGeoLocationSetting() {
  const settings = await readAllSettings();
  return settings.geo_location;
}

export async function writeGeoLocationSetting(value: string | null) {
  const existing = await readAllSettings();
  await writeAllSettings({ ...existing, geo_location: value });
}

async function readOxylabsSchedulerId() {
  const settings = await readAllSettings();
  return settings.oxylabsSchedulerId;
}

async function writeOxylabsSchedulerId(value: string | null) {
  const existing = await readAllSettings();
  await writeAllSettings({ ...existing, oxylabsSchedulerId: value });
}

async function readOxylabsSchedulerLastProcessedRunId() {
  const settings = await readAllSettings();
  return settings.oxylabsSchedulerLastProcessedRunId;
}

async function writeOxylabsSchedulerLastProcessedRunId(value: string | null) {
  const existing = await readAllSettings();
  await writeAllSettings({ ...existing, oxylabsSchedulerLastProcessedRunId: value });
}

async function oxylabsSchedulesRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${OXYLABS_SCHEDULES_URL}${path}`, {
    ...init,
    headers: {
      Authorization: getOxylabsAuthHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const bodyText = await response.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = bodyText ? parseJsonWithStringifiedIds(bodyText) : null;
  } catch {
    parsedBody = bodyText || null;
  }

  if (!response.ok) {
    throw new Error(`Oxylabs Scheduler request failed (${response.status}): ${bodyText || JSON.stringify(parsedBody)}`);
  }

  return { parsedBody, bodyText };
}

async function oxylabsQueriesRequest(path: string) {
  const response = await fetch(`${OXYLABS_QUERIES_URL}${path}`, {
    method: "GET",
    headers: { Authorization: getOxylabsAuthHeader() },
    cache: "no-store",
  });

  const bodyText = await response.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    parsedBody = bodyText || null;
  }

  if (!response.ok) {
    throw new Error(`Oxylabs query request failed (${response.status}): ${bodyText || JSON.stringify(parsedBody)}`);
  }

  return parsedBody;
}

function normalizeOxylabsScheduleResponse(parsedBody: unknown, bodyText: string): OxylabsScheduleResponse {
  if (!isRecord(parsedBody)) {
    throw new Error("Oxylabs Scheduler returned an invalid response.");
  }

  const scheduleId = extractLargeNumericField(bodyText, "schedule_id");
  if (!scheduleId) {
    throw new Error("Oxylabs Scheduler response did not include a valid schedule ID.");
  }

  return {
    scheduleId,
    active: parsedBody.active === true,
    itemsCount: typeof parsedBody.items_count === "number" ? parsedBody.items_count : null,
    cron: typeof parsedBody.cron === "string" ? parsedBody.cron : null,
    endTime: typeof parsedBody.end_time === "string" ? parsedBody.end_time : null,
    nextRunAt: typeof parsedBody.next_run_at === "string" ? parsedBody.next_run_at : null,
  };
}

async function createOxylabsSchedule() {
  const geoLocation = await readGeoLocationSetting();
  const payload = {
    cron: OXYLABS_SCHEDULE_CRON,
    items: [
      {
        source: "amazon_search",
        domain: "com",
        query: OXYLABS_SCHEDULE_QUERY,
        parse: true,
        pages: 7,
        ...(geoLocation ? { geo_location: geoLocation } : {}),
      },
    ],
    end_time: getOxylabsScheduleEndTime(),
  };

  const { parsedBody, bodyText } = await oxylabsSchedulesRequest("", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return normalizeOxylabsScheduleResponse(parsedBody, bodyText);
}

async function getOxylabsSchedule(scheduleId: string) {
  const { parsedBody, bodyText } = await oxylabsSchedulesRequest(`/${scheduleId}`, { method: "GET" });
  return normalizeOxylabsScheduleResponse(parsedBody, bodyText);
}

async function setOxylabsScheduleState(scheduleId: string, active: boolean) {
  await oxylabsSchedulesRequest(`/${scheduleId}/state`, {
    method: "PUT",
    body: JSON.stringify({ active }),
  });

  return getOxylabsSchedule(scheduleId);
}

async function getOxylabsScheduleRuns(scheduleId: string): Promise<OxylabsScheduleRun[]> {
  const { parsedBody } = await oxylabsSchedulesRequest(`/${scheduleId}/runs`, { method: "GET" });
  if (!isRecord(parsedBody) || !Array.isArray(parsedBody.runs)) {
    return [];
  }

  return parsedBody.runs.flatMap((run) => {
    if (!isRecord(run) || typeof run.run_id !== "string") {
      return [];
    }

    const jobs = Array.isArray(run.jobs)
      ? run.jobs.flatMap((job) => {
          if (!isRecord(job) || typeof job.id !== "string") {
            return [];
          }

          return [{
            id: job.id,
            createStatusCode: typeof job.create_status_code === "number" ? job.create_status_code : null,
            resultStatus: typeof job.result_status === "string" ? job.result_status : null,
            createdAt: typeof job.created_at === "string" ? job.created_at : null,
            resultCreatedAt: typeof job.result_created_at === "string" ? job.result_created_at : null,
          }];
        })
      : [];

    return [{
      runId: run.run_id,
      jobs,
      successRate: typeof run.success_rate === "number" ? run.success_rate : null,
    }];
  });
}

async function getOxylabsQueryResults(queryId: string, resultTypes: string[] = ["parsed"]) {
  const typesQuery = encodeURIComponent(resultTypes.join(","));
  return oxylabsQueriesRequest(`/${queryId}/results?type=${typesQuery}`);
}

async function syncOxylabsSchedulerRuns() {
  const scheduleId = await readOxylabsSchedulerId();
  if (!scheduleId || oxylabsSyncState.isRunning) {
    return {
      lastProcessedRunId: await readOxylabsSchedulerLastProcessedRunId(),
      syncedNewRun: false,
    };
  }

  oxylabsSyncState.isRunning = true;
  try {
    const lastProcessedRunId = await readOxylabsSchedulerLastProcessedRunId();
    const runs = await getOxylabsScheduleRuns(scheduleId);
    const completedRuns = runs
      .filter((run) => run.jobs.some((job) => job.resultStatus === "done"))
      .sort((a, b) => {
        const aTime = a.jobs[0]?.resultCreatedAt ?? a.jobs[0]?.createdAt ?? "";
        const bTime = b.jobs[0]?.resultCreatedAt ?? b.jobs[0]?.createdAt ?? "";
        return aTime.localeCompare(bTime);
      });

    const startIndex = lastProcessedRunId ? completedRuns.findIndex((run) => run.runId === lastProcessedRunId) + 1 : 0;
    const pendingRuns = completedRuns.slice(Math.max(startIndex, 0));

    let latestProcessedRunId = lastProcessedRunId;
    let syncedNewRun = false;

    for (const run of pendingRuns) {
      const completedJob = run.jobs.find((job) => job.resultStatus === "done");
      if (!completedJob) continue;

      const searchResponse = await getOxylabsQueryResults(completedJob.id, ["parsed"]);
      const geoLocation = await readGeoLocationSetting();
      await scrapeAndPersistFromSearchResponse(searchResponse, {
        geoLocation,
        lastUpdated: toIsoDate(completedJob.resultCreatedAt ?? completedJob.createdAt),
      });
      latestProcessedRunId = run.runId;
      syncedNewRun = true;
      await writeOxylabsSchedulerLastProcessedRunId(run.runId);
    }

    return { lastProcessedRunId: latestProcessedRunId, syncedNewRun };
  } finally {
    oxylabsSyncState.isRunning = false;
  }
}

export function initOxylabsSchedulerSync() {
  if (oxylabsSyncState.isInitialized) return;

  oxylabsSyncState.task = cron.schedule(OXYLABS_SYNC_CRON, () => {
    void syncOxylabsSchedulerRuns();
  });
  oxylabsSyncState.isInitialized = true;
  console.log("[Oxylabs Sync] Ready. Checking for completed runs every minute.");
}

function buildEmptySchedulerStatus(): OxylabsSchedulerStatus {
  return {
    scheduleId: null,
    active: null,
    nextRunAt: null,
    isRunning: false,
  };
}

export async function getOxylabsSchedulerStatus() {
  const scheduleId = await readOxylabsSchedulerId();
  if (!scheduleId) {
    return buildEmptySchedulerStatus();
  }

  try {
    const schedule = await getOxylabsSchedule(scheduleId);
    return {
      scheduleId: schedule.scheduleId,
      active: schedule.active,
      nextRunAt: schedule.nextRunAt,
      isRunning: oxylabsSyncState.isRunning,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("404")) {
      await writeOxylabsSchedulerId(null);
      await writeOxylabsSchedulerLastProcessedRunId(null);
      return buildEmptySchedulerStatus();
    }
    throw error;
  }
}

export async function enableOxylabsScheduler() {
  initOxylabsSchedulerSync();

  let scheduleId = await readOxylabsSchedulerId();
  if (!scheduleId) {
    const schedule = await createOxylabsSchedule();
    scheduleId = schedule.scheduleId;
    await writeOxylabsSchedulerId(scheduleId);
    await writeOxylabsSchedulerLastProcessedRunId(null);
  }

  await setOxylabsScheduleState(scheduleId, true);
  return getOxylabsSchedulerStatus();
}

export async function disableOxylabsScheduler() {
  const scheduleId = await readOxylabsSchedulerId();
  if (!scheduleId) {
    return getOxylabsSchedulerStatus();
  }

  await setOxylabsScheduleState(scheduleId, false);
  return getOxylabsSchedulerStatus();
}
