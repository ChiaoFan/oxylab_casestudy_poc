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
};

type ScrapeData = {
  last_updated: string;
  products: ProductRow[];
};

type SettingsData = {
  geo_location: string | null;
  default_geo_location: string;
};

function formatDelivery(value: unknown): string {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => JSON.stringify(item)).join(" | ");
  return JSON.stringify(value);
}

function formatPrice(value: number | string | null): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return `$${value.toFixed(2)}`;
  return value;
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

  function downloadJson() {
    if (!data) return;
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = data.last_updated.replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `tecnovaai_iphone_top5_${timestamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!mounted) return null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 font-sans">
      <section className="rounded-lg border border-foreground/20 p-5">
        <h1 className="text-2xl font-semibold">TechNovaAI Amazon iPhone Monitor</h1>
        <p className="mt-1 text-sm opacity-80">Last updated: {data?.last_updated ?? "-"}</p>

        <div className="mt-4 rounded-md border border-foreground/20 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Geo-location: <strong>{currentGeoLocation}</strong>
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
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Prime</th>
                    <th className="px-3 py-2 font-medium">Sponsored</th>
                    <th className="px-3 py-2 font-medium">Delivery</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.products ?? []).map((product) => (
                    <tr key={product.asin} className="border-b border-foreground/10">
                      <td className="px-3 py-2">{product.pos}</td>
                      <td className="px-3 py-2">{product.asin}</td>
                      <td className="px-3 py-2">{formatPrice(product.price)}</td>
                      <td className="px-3 py-2">{product.is_prime === null ? "-" : product.is_prime ? "Yes" : "No"}</td>
                      <td className="px-3 py-2">
                        {product.is_sponsored === null ? "-" : product.is_sponsored ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2">{formatDelivery(product.delivery)}</td>
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
