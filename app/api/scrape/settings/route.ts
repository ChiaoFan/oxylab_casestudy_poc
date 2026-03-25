import { NextResponse } from "next/server";
import { DEFAULT_GEO_LOCATION, normalizeGeoLocation, readGeoLocationSetting, writeGeoLocationSetting } from "../system/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Feature: Geo-location Settings Controller for Frontend Integration.
 *
 * GET  — Returns the current saved geo-location and the default fallback value.
 *         Used by the UI to display the active geo-location in the settings card.
 *
 * POST — Accepts a new geo-location value from the UI, normalizes and validates it,
 *         persists it to disk, and returns the updated setting.
 *         Used by the UI's geo-location editor when the user saves a new ZIP code.
 **/

// Returns the current geo-location setting and the default fallback value.
export async function GET() {
  try {
    return NextResponse.json({
      geo_location: await readGeoLocationSetting(),
      default_geo_location: DEFAULT_GEO_LOCATION,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Accepts a new geo-location value, validates it, saves it, and returns the updated setting.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { geo_location?: unknown };

    // Normalize and validate the incoming value (e.g. trim, null-check, ZIP format).
    const geoLocation = normalizeGeoLocation(body.geo_location);

    await writeGeoLocationSetting(geoLocation);

    return NextResponse.json({
      geo_location: geoLocation,
      default_geo_location: DEFAULT_GEO_LOCATION,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
