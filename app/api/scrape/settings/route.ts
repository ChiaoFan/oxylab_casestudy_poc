import { NextResponse } from "next/server";
import { DEFAULT_GEO_LOCATION, normalizeGeoLocation, readGeoLocationSetting, writeGeoLocationSetting } from "../system/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
*  Geo-location Settings Controller for Frontend Integration.
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
