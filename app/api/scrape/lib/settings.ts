import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_GEO_LOCATION = "90210";
const OUTPUT_DIR = join(process.cwd(), "output");
const SETTINGS_FILE = join(OUTPUT_DIR, "tecnovaai_settings.json");

type SettingsPayload = {
  geo_location: string | null;
  autoScrapingEnabled: boolean;
};

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

export async function readGeoLocationSetting(): Promise<string | null> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<SettingsPayload>;

    if (!("geo_location" in parsed)) {
      return DEFAULT_GEO_LOCATION;
    }

    return normalizeGeoLocation(parsed.geo_location);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("ENOENT")) {
      return DEFAULT_GEO_LOCATION;
    }

    throw error;
  }
}

export async function writeGeoLocationSetting(value: string | null) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const existing = await readAllSettings();
  const payload: SettingsPayload = {
    geo_location: value,
    autoScrapingEnabled: existing.autoScrapingEnabled,
  };
  await writeFile(SETTINGS_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function readAutoScrapingEnabled(): Promise<boolean> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<SettingsPayload>;
    return parsed.autoScrapingEnabled ?? false;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("ENOENT")) {
      return false;
    }
    throw error;
  }
}

export async function writeAutoScrapingEnabled(value: boolean) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const existing = await readAllSettings();
  const payload: SettingsPayload = {
    geo_location: existing.geo_location,
    autoScrapingEnabled: value,
  };
  await writeFile(SETTINGS_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readAllSettings(): Promise<SettingsPayload> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf8");
    return JSON.parse(raw) as SettingsPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("ENOENT")) {
      return { geo_location: DEFAULT_GEO_LOCATION, autoScrapingEnabled: false };
    }
    throw error;
  }
}

export function buildGeoContext(geoLocation: string | null) {
  return geoLocation ? [{ key: "geo_location", value: geoLocation }] : undefined;
}
