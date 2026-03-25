import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type OxylabsStatsProduct = {
  all_count?: number;
  average_response_time?: number;
  title?: string;
};

type OxylabsStatsResponse = {
  data?: {
    products?: OxylabsStatsProduct[];
  };
};

const TARGET_PRODUCT_TITLE = "web_scraper_api";

function getCredentials() {
  const user = process.env.OXYLABS_USER;
  const pass = process.env.OXYLABS_PASS;

  if (!user || !pass) {
    throw new Error("Missing OXYLABS_USER or OXYLABS_PASS environment variables.");
  }

  return { user, pass };
}

// Feature: Usage Statistics API integration.
// Calls Oxylabs /v2/stats to get usage statistics for the web_scraper_api products
export async function GET() {
  try {
    const { user, pass } = getCredentials();
    const response = await fetch("https://data.oxylabs.io/v2/stats", {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
      },
      cache: "no-store",
    });

    const bodyText = await response.text();
    let parsedBody: unknown;

    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      throw new Error(`Oxylabs Usage Statistics returned non-JSON (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(`Oxylabs Usage Statistics failed (${response.status}): ${bodyText}`);
    }

    const stats = parsedBody as OxylabsStatsResponse;
    const products = Array.isArray(stats.data?.products) ? stats.data.products : [];
    const selectedProduct = products.find((product) => product.title === TARGET_PRODUCT_TITLE);

    if (!selectedProduct) {
      throw new Error(`Oxylabs Usage Statistics missing expected product: ${TARGET_PRODUCT_TITLE}.`);
    }

    // Return direct values from the stats JSON payload.
    return NextResponse.json({
      title: TARGET_PRODUCT_TITLE,
      all_count: typeof selectedProduct.all_count === "number" ? selectedProduct.all_count : 0,
      average_response_time:
        typeof selectedProduct.average_response_time === "number"
          ? selectedProduct.average_response_time
          : null,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
