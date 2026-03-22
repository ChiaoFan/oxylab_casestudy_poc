import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildGeoContext, readGeoLocationSetting } from "./lib/settings";

type OxylabsSearchItem = {
  asin?: string;
  pos?: number;
  is_prime?: boolean;
  is_sponsored?: boolean;
};

type ScrapedProduct = {
  asin: string;
  pos: number;
  title: string | null;
  is_prime: boolean | null;
  is_sponsored: boolean | null;
  price: number | string | null;
  delivery: unknown;
  description: unknown;
  product_details: unknown;
};

type ScrapeResponse = {
  last_updated: string;
  products: ScrapedProduct[];
};

const OXYLABS_ENDPOINT = "https://data.oxylabs.io/v1/queries";
const SEARCH_QUERY = "iphone";
const MAX_PRODUCTS = 3;
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 180000;
const OUTPUT_DIR = join(process.cwd(), "output");
const LATEST_OUTPUT_FILE = join(OUTPUT_DIR, "tecnovaai_iphone_top100_latest.json");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getCredentials() {
  const user = process.env.OXYLABS_USER;
  const pass = process.env.OXYLABS_PASS;

  if (!user || !pass) {
    throw new Error("Missing OXYLABS_USER or OXYLABS_PASS environment variables.");
  }

  return { user, pass };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function oxylabsRequest(payload: Record<string, unknown>) {
  const { user, pass } = getCredentials();
  
  console.log("[oxylabs endpoint]", OXYLABS_ENDPOINT);
  console.log("[amazon_search payload]", payload);
  const response = await fetch(OXYLABS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const bodyText = await response.text();
  console.log("--- response body:  ---", bodyText);
  let parsedBody: unknown;

  try {
    parsedBody = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    throw new Error(`Oxylabs returned non-JSON (${response.status}).`);
  }

  if (response.status === 202 && isRecord(parsedBody) && typeof parsedBody.id === "string") {
    return pollQueryResults(parsedBody.id);
  }

  if (!response.ok) {
    const err = isRecord(parsedBody) ? parsedBody : { message: bodyText };
    throw new Error(`Oxylabs request failed (${response.status}): ${JSON.stringify(err)}`);
  }

  return parsedBody;
}


/**
Integration: Push-Pull (Asynchronous)
Initiates scrapes on-demand via POST and retrieves results via GET
This keeps my server resources free because I don't have to maintain an active connection during the entire scraping lifecycle
 **/
async function pollQueryResults(queryId: string) {
  const { user, pass } = getCredentials();
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const response = await fetch(`${OXYLABS_ENDPOINT}/${queryId}/results?type=parsed`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
      },
      cache: "no-store",
    });

    if (response.status === 204) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    const bodyText = await response.text();
    let parsedBody: unknown;

    try {
      parsedBody = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      throw new Error(`Oxylabs poll returned non-JSON (${response.status}).`);
    }

    if (response.ok) {
      return parsedBody;
    }

    if (response.status !== 202 && response.status !== 404) {
      const err = isRecord(parsedBody) ? parsedBody : { message: bodyText };
      throw new Error(`Oxylabs polling failed (${response.status}): ${JSON.stringify(err)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Oxylabs polling timed out for query ${queryId}.`);
}

function extractResultsContent(oxylabsResponse: unknown): unknown {
  if (!isRecord(oxylabsResponse)) return null;
  const results = oxylabsResponse.results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const first = results[0];
  if (!isRecord(first)) return null;
  return first.content ?? null;
}

function extractAllResultsContents(oxylabsResponse: unknown): unknown[] {
  if (!isRecord(oxylabsResponse)) return [];
  const results = oxylabsResponse.results;
  if (!Array.isArray(results) || results.length === 0) return [];

  const contents: unknown[] = [];
  for (const result of results) {
    if (!isRecord(result) || result.content == null) continue;
    contents.push(result.content);
  }

  return contents;
}

function collectSearchRows(node: unknown, rows: OxylabsSearchItem[] = []): OxylabsSearchItem[] {
  if (Array.isArray(node)) {
    for (const value of node) collectSearchRows(value, rows);
    return rows;
  }

  if (!isRecord(node)) return rows;

  if (typeof node.asin === "string" && node.asin.trim()) {
    rows.push({
      asin: node.asin,
      pos: typeof node.pos === "number" ? node.pos : undefined,
      is_prime: typeof node.is_prime === "boolean" ? node.is_prime : undefined,
      is_sponsored: typeof node.is_sponsored === "boolean" ? node.is_sponsored : undefined,
    });
  }

  for (const value of Object.values(node)) {
    collectSearchRows(value, rows);
  }

  return rows;
}

/**
 * Selection: Top Products (Deduplicated)
 * Keeps the first unique ASIN entries in ranking order and limits output to MAX_PRODUCTS.
 * This keeps downstream detail scraping focused and avoids duplicate requests.
 **/
function uniqueTopProducts(rows: OxylabsSearchItem[]): OxylabsSearchItem[] {
  const seen = new Set<string>();
  const unique: OxylabsSearchItem[] = [];

  for (const [index, row] of rows.entries()) {
    if (!row.asin || seen.has(row.asin)) continue;
    seen.add(row.asin);
    unique.push({
      asin: row.asin,
      pos: typeof row.pos === "number" ? row.pos : index + 1,
      is_prime: row.is_prime,
      is_sponsored: row.is_sponsored,
    });
    if (unique.length >= MAX_PRODUCTS) break;
  }

  return unique.map((row, index) => ({ ...row, pos: index + 1 }));
}

function deepFind(node: unknown, candidates: string[]): unknown {
  if (Array.isArray(node)) {
    for (const value of node) {
      const found = deepFind(value, candidates);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (!isRecord(node)) return undefined;

  for (const key of candidates) {
    if (key in node && node[key] !== undefined && node[key] !== null) {
      return node[key];
    }
  }

  for (const value of Object.values(node)) {
    const found = deepFind(value, candidates);
    if (found !== undefined) return found;
  }

  return undefined;
}

function normalizePrice(value: unknown): number | string | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : value;
  }

  if (isRecord(value)) {
    const nested = value.price ?? value.amount ?? value.value ?? null;
    return normalizePrice(nested);
  }

  return null;
}

function mapDetailContent(content: unknown) {
  const rawTitle = deepFind(content, ["title", "product_name", "name", "product_title"]);

  return {
    title: typeof rawTitle === "string" ? rawTitle : null,
    price: normalizePrice(deepFind(content, ["price", "current_price", "buybox_price", "price_amount"])),
    description: deepFind(content, ["description", "product_description", "about_this_item"]) ?? null,
    product_details: deepFind(content, ["product_details", "specifications", "details"]) ?? null,
    delivery: deepFind(content, ["delivery", "delivery_info", "shipping", "fulfillment"]) ?? null,
    is_prime: (deepFind(content, ["is_prime_eligible"]) as boolean | undefined) ?? null,
  };
}

async function fetchSearchProducts(geoLocation: string | null) {
  const payload = {
    source: "amazon_search",
    query: SEARCH_QUERY,
    parse: true,
    pages: 7,
    render: "html",
    domain: "com",
    geo_location: geoLocation
  };

  const response = await oxylabsRequest(payload);
  const contents = extractAllResultsContents(response);
  const rows = contents.flatMap((content) => collectSearchRows(content));
  const uniqueRows = uniqueTopProducts(rows);

  console.log("[amazon_search counts]", {
    pages_requested: payload.pages,
    page_contents: contents.length,
    rows_found: rows.length,
    unique_rows: uniqueRows.length,
    max_products: MAX_PRODUCTS,
  });

  return uniqueRows;
}

async function fetchProductDetails(asin: string) {
  const payload = {
    source: "amazon_product",
    query: asin,
    parse: true,
    render: "html"
  };
  console.log("[amazon_product payload]", payload);
  const response = await oxylabsRequest(payload);
  const content = extractResultsContent(response);
  return mapDetailContent(content);
}

async function persistOutput(payload: ScrapeResponse) {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const timestamp = payload.last_updated.replace(/[:.]/g, "-");
  const timestampedFile = join(OUTPUT_DIR, `tecnovaai_iphone_top100_${timestamp}.json`);
  const data = `${JSON.stringify(payload, null, 2)}\n`;

  await writeFile(timestampedFile, data, "utf8");
  await writeFile(LATEST_OUTPUT_FILE, data, "utf8");
}

async function readLatestOutput() {
  const raw = await readFile(LATEST_OUTPUT_FILE, "utf8");
  const parsed = JSON.parse(raw) as ScrapeResponse;

  if (!parsed || !Array.isArray(parsed.products) || typeof parsed.last_updated !== "string") {
    throw new Error("Latest output file has invalid JSON structure.");
  }

  return parsed;
}

async function scrapeAndPersist() {
  const geoLocation = await readGeoLocationSetting();
  const found = await fetchSearchProducts(geoLocation);

  const products: ScrapedProduct[] = [];
  for (const row of found) {
    if (!row.asin) continue;
    const details = await fetchProductDetails(row.asin);
    products.push({
      asin: row.asin,
      pos: row.pos ?? products.length + 1,
      title: details.title,
      is_prime: details.is_prime ?? row.is_prime ?? null,
      is_sponsored: row.is_sponsored ?? null,
      price: details.price,
      delivery: details.delivery,
      description: details.description,
      product_details: details.product_details,
    });
  }

  const body: ScrapeResponse = {
    last_updated: new Date().toISOString(),
    products,
  };

  await persistOutput(body);
  return body;
}

export async function GET() {
  try {
    const latest = await readLatestOutput();
    return NextResponse.json(latest);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("ENOENT")) {
      return NextResponse.json(
        {
          error:
            "No saved output found yet. Run a scrape first with POST /api/scrape to generate output/tecnovaai_iphone_top100_latest.json.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const body = await scrapeAndPersist();
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
