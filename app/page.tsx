"use client";

import { useEffect, useMemo, useState } from "react";

type ProductRow = {
  asin: string;
  pos: number;
  title?: string | null;
  price: number | string | null;
  is_prime: boolean | null;
  is_sponsored: boolean | null;
  delivery: unknown;
  description: unknown;
  product_details: unknown;
};

type ScrapeData = {
  last_updated: string;
  products: ProductRow[];
};

type SettingsData = {
  geo_location: string | null;
  default_geo_location: string;
};

type SortKey = "price" | "is_prime" | "is_sponsored";
type SortDirection = "asc" | "desc";

function formatPrice(value: number | string | null): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return `$${value.toFixed(2)}`;
  return value;
}

function getPriceSortValue(value: number | string | null): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function renderStructuredValue(value: unknown) {
  if (value === null || value === undefined) return <span>-</span>;

  if (typeof value === "string") {
    if (value.length <= 180) {
      return <span className="whitespace-pre-wrap">{value}</span>;
    }

    return (
      <details>
        <summary className="cursor-pointer opacity-80">View text</summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-foreground/20 p-2 text-xs">
          {value}
        </pre>
      </details>
    );
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }

  return (
    <details>
      <summary className="cursor-pointer opacity-80">View JSON</summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-foreground/20 p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-label="Loading"
    />
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ScrapeData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [draftGeoLocation, setDraftGeoLocation] = useState("");
  const [isEditingGeo, setIsEditingGeo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [isSavingGeo, setIsSavingGeo] = useState(false);
  const [isDownloadingMarkdown, setIsDownloadingMarkdown] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [error, setError] = useState<string | null>(null);

  const currentGeoLocation = settings ? (settings.geo_location ?? "null") : "90210";

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/scrape", { cache: "no-store" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Failed to load saved data.");
      }

      setData(body as ScrapeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  async function runScrape() {
    try {
      setIsScraping(true);
      setError(null);
      const response = await fetch("/api/scrape", { method: "POST", cache: "no-store" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Scrape failed.");
      }

      setData(body as ScrapeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsScraping(false);
    }
  }

  async function loadSettings() {
    try {
      const response = await fetch("/api/scrape/settings", { cache: "no-store" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Failed to load geo-location setting.");
      }

      const nextSettings = body as SettingsData;
      setSettings(nextSettings);
      setDraftGeoLocation(nextSettings.geo_location ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function saveGeoLocation() {
    try {
      setIsSavingGeo(true);
      setError(null);

      const value = draftGeoLocation.trim();
      const response = await fetch("/api/scrape/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geo_location: value === "" ? null : value }),
        cache: "no-store",
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Failed to save geo-location setting.");
      }

      const nextSettings = body as SettingsData;
      setSettings(nextSettings);
      setDraftGeoLocation(nextSettings.geo_location ?? "");
      setIsEditingGeo(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSavingGeo(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    void loadData();
    void loadSettings();
  }, []);

  const exportJson = useMemo(() => {
    if (!data) return "";
    return JSON.stringify(data, null, 2);
  }, [data]);

  const sortedProducts = useMemo(() => {
    const products = [...(data?.products ?? [])];

    products.sort((a, b) => {
      if (sortKey === "price") {
        const aValue = getPriceSortValue(a.price);
        const bValue = getPriceSortValue(b.price);
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const aBool = a[sortKey];
      const bBool = b[sortKey];
      if (aBool === bBool) return 0;
      if (aBool === null) return 1;
      if (bBool === null) return -1;

      const aValue = aBool ? 1 : 0;
      const bValue = bBool ? 1 : 0;
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });

    return products;
  }, [data?.products, sortDirection, sortKey]);

  function handleSortClick(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  function downloadJson() {
    if (!data) return;
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = data.last_updated.replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `tecnovaai_iphone_top100_${timestamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadMarkdownFile() {
    try {
      setIsDownloadingMarkdown(true);
      setError(null);

      const response = await fetch("/api/scrape/markdown", { cache: "no-store" });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        const errorMessage = body?.error;
        throw new Error(errorMessage || "Failed to load markdown output.");
      }

      const markdown = await response.text();
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      anchor.href = url;
      anchor.download = `tecnovaai_iphone_markdown_${timestamp}.md`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsDownloadingMarkdown(false);
    }
  }

  if (!mounted) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 font-sans">
      <section className="rounded-lg border border-foreground/20 p-5">
        <h1 className="text-2xl font-semibold">TechNovaAI Amazon iPhone Monitor</h1>
        <p className="mt-1 text-sm opacity-80">Last updated: {data?.last_updated ?? "-"}</p>

        <div className="mt-4 rounded-md border border-foreground/20 p-4 text-sm">
          <p className="mb-3">
            Amazon marketplace: <strong>amazon.com</strong>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Postcode (Geo-location): <strong>{currentGeoLocation}</strong>
            </span>
            {!isEditingGeo ? (
              <button
                onClick={() => setIsEditingGeo(true)}
                className="cursor-pointer rounded-md border border-foreground/30 px-3 py-1 font-medium"
              >
                Edit
              </button>
            ) : (
              <>
                <input
                  value={draftGeoLocation}
                  onChange={(event) => setDraftGeoLocation(event.target.value)}
                  placeholder={settings?.default_geo_location ?? "90210"}
                  className="rounded-md border border-foreground/30 px-3 py-1"
                />
                <button
                  onClick={() => void saveGeoLocation()}
                  disabled={isSavingGeo}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-foreground/30 px-3 py-1 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingGeo && <Spinner />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setDraftGeoLocation(settings?.geo_location ?? "");
                    setIsEditingGeo(false);
                  }}
                  className="cursor-pointer rounded-md border border-foreground/30 px-3 py-1 font-medium"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
          <p className="mt-2 opacity-70">Enter a 5-digit ZIP from 00501 to 99950, or leave it blank for null.</p>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => void runScrape()}
            disabled={isScraping}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-foreground/30 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isScraping && <Spinner />}
            {isScraping ? "Scraping…" : "Run New Scrape"}
          </button>
          <button
            onClick={downloadJson}
            disabled={!data}
            className="cursor-pointer rounded-md border border-foreground/30 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download JSON
          </button>
          <button
            onClick={() => void downloadMarkdownFile()}
            disabled={isDownloadingMarkdown}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-foreground/30 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDownloadingMarkdown && <Spinner />}
            {isDownloadingMarkdown ? "Downloading…" : "Download Markdown"}
          </button>
        </div>

        <div className="mt-6">
          {isLoading && <p className="text-sm">Loading latest scrape data…</p>}
          {error && <p className="text-sm text-red-500">Error: {error}</p>}
          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-foreground/20 text-left">
                    <th className="px-3 py-2 font-medium">Position</th>
                    <th className="px-3 py-2 font-medium">ASIN</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">
                      <button
                        onClick={() => handleSortClick("price")}
                        className="cursor-pointer"
                        type="button"
                      >
                        Price {sortIndicator("price")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <button
                        onClick={() => handleSortClick("is_prime")}
                        className="cursor-pointer"
                        type="button"
                      >
                        Prime {sortIndicator("is_prime")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium">
                      <button
                        onClick={() => handleSortClick("is_sponsored")}
                        className="cursor-pointer"
                        type="button"
                      >
                        Sponsored {sortIndicator("is_sponsored")}
                      </button>
                    </th>
                    <th className="px-3 py-2 font-medium">Delivery</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Product Details</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((product) => (
                    <tr key={product.asin} className="border-b border-foreground/10 align-top">
                      <td className="px-3 py-2">{product.pos}</td>
                      <td className="px-3 py-2">{product.asin}</td>
                      <td className="px-3 py-2 min-w-[260px]">{product.title ?? "-"}</td>
                      <td className="px-3 py-2">{formatPrice(product.price)}</td>
                      <td className="px-3 py-2">{product.is_prime === null ? "-" : product.is_prime ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        {product.is_sponsored === null ? "-" : product.is_sponsored ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2 min-w-[220px]">{renderStructuredValue(product.delivery)}</td>
                      <td className="px-3 py-2 min-w-[300px]">{renderStructuredValue(product.description)}</td>
                      <td className="px-3 py-2 min-w-[320px]">{renderStructuredValue(product.product_details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
