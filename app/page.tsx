"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  CssBaseline,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, createTheme, ThemeProvider } from "@mui/material/styles";

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

type OxylabsSchedulerStatus = {
  scheduleId: string | null;
  active: boolean | null;
  nextRunAt: string | null;
  isRunning: boolean;
};

type OxylabsSchedulerAction = "enable_oxylabs_scheduler" | "disable_oxylabs_scheduler";

type SortKey = "pos" | "price" | "is_prime" | "is_sponsored";
type SortDirection = "asc" | "desc";

const oxylabsSoftTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#12BFB3" },
    secondary: { main: "#3AA8D8" },
    background: {
      default: "#F5FAFC",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#15324A",
      secondary: "#587087",
    },
    divider: alpha("#6B8CA8", 0.22),
  },
  shape: { borderRadius: 12 },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${alpha("#6B8CA8", 0.14)}`,
          boxShadow: "0 8px 24px rgba(12, 73, 109, 0.06)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: "#F1F8FB",
          color: "#1C3E59",
          fontWeight: 600,
        },
      },
    },
  },
});

function formatPrice(value: number | string | null): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") return `$${value.toFixed(2)}`;
  return value;
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  try {
    const normalized = value.includes("Z") || value.includes("+")
      ? value
      : (value.includes("T") ? value : value.replace(" ", "T")) + "Z";
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
}

function getPriceSortValue(value: number | string | null): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function renderStructuredValue(value: unknown) {
  if (value === null || value === undefined) return <Typography variant="body2">-</Typography>;

  if (typeof value === "string") {
    if (value.length <= 180) {
      return <Typography variant="body2">{value}</Typography>;
    }

    return (
      <Box component="details">
        <Box component="summary" sx={{ cursor: "pointer", color: "text.secondary" }}>
          View text
        </Box>
        <Box
          component="pre"
          sx={{
            mt: 1,
            p: 1,
            maxHeight: 200,
            overflow: "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            m: 0,
          }}
        >
          {value}
        </Box>
      </Box>
    );
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <Typography variant="body2">{String(value)}</Typography>;
  }

  return (
    <Box component="details">
      <Box component="summary" sx={{ cursor: "pointer", color: "text.secondary" }}>
        View JSON
      </Box>
      <Box
        component="pre"
        sx={{
          mt: 1,
          p: 1,
          maxHeight: 200,
          overflow: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 1,
          fontSize: 12,
          whiteSpace: "pre-wrap",
          m: 0,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    </Box>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ScrapeData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [draftGeoLocation, setDraftGeoLocation] = useState("");
  const [isEditingGeo, setIsEditingGeo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGeo, setIsSavingGeo] = useState(false);
  const [isDownloadingMarkdown, setIsDownloadingMarkdown] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("pos");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [error, setError] = useState<string | null>(null);
  const [oxylabsSchedulerStatus, setOxylabsSchedulerStatus] = useState<OxylabsSchedulerStatus | null>(null);
  const [isTogglingOxylabsScheduler, setIsTogglingOxylabsScheduler] = useState(false);

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

  async function loadSchedulerStatus() {
    try {
      const response = await fetch("/api/scrape/system", { cache: "no-store" });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Failed to load scheduler status.");
      }

      setOxylabsSchedulerStatus((body.oxylabsScheduler ?? null) as OxylabsSchedulerStatus | null);
    } catch (err) {
      console.error("Error loading scheduler status:", err);
    }
  }

  async function enableOxylabsScheduler() {
    await updateOxylabsScheduler("enable_oxylabs_scheduler");
  }

  async function disableOxylabsScheduler() {
    await updateOxylabsScheduler("disable_oxylabs_scheduler");
  }

  async function updateOxylabsScheduler(action: OxylabsSchedulerAction) {
    try {
      setIsTogglingOxylabsScheduler(true);
      setError(null);

      const response = await fetch("/api/scrape/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        cache: "no-store",
      });
      const body = await response.json();

      if (!response.ok) {
        const fallbackMessage = action === "enable_oxylabs_scheduler"
          ? "Failed to enable Oxylabs scheduler."
          : "Failed to disable Oxylabs scheduler.";
        throw new Error(body?.error || fallbackMessage);
      }

      setOxylabsSchedulerStatus((body.oxylabsScheduler ?? null) as OxylabsSchedulerStatus | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsTogglingOxylabsScheduler(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    void loadData();
    void loadSettings();

    // Initialize scheduler on app start
    fetch("/api/health", { cache: "no-store" }).catch(console.error);
    void loadSchedulerStatus();
  }, []);

  const isSchedulerScraping = oxylabsSchedulerStatus?.isRunning === true;

  // Poll scheduler status: every 60s while scraping, every 30s otherwise
  useEffect(() => {
    const interval = setInterval(() => {
      void loadSchedulerStatus();
    }, isSchedulerScraping ? 60000 : 30000);

    return () => clearInterval(interval);
  }, [isSchedulerScraping]);

  // While scheduler scrape is running, keep refreshing latest output
  // so `data.last_updated` can flip and stop the spinner immediately.
  useEffect(() => {
    if (!isSchedulerScraping) return;

    void loadData();
    const interval = setInterval(() => {
      void loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, [isSchedulerScraping]);

  const exportJson = useMemo(() => {
    if (!data) return "";
    return JSON.stringify(data, null, 2);
  }, [data]);

  const sortedProducts = useMemo(() => {
    const products = [...(data?.products ?? [])];

    products.sort((a, b) => {
      if (sortKey === "pos") {
        return sortDirection === "asc" ? a.pos - b.pos : b.pos - a.pos;
      }

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

  function downloadJson() {
    if (!data) return;
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = data.last_updated.replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `json_${timestamp}.json`;
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
      anchor.download = `markdown_${timestamp}.md`;
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
    <ThemeProvider theme={oxylabsSoftTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          py: 4,
          background:
            "radial-gradient(circle at 10% 0%, rgba(18,191,179,0.10) 0%, rgba(245,250,252,0) 38%), radial-gradient(circle at 90% 10%, rgba(58,168,216,0.10) 0%, rgba(245,250,252,0) 36%), #F5FAFC",
        }}
      >
        <Container maxWidth="xl">
          <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, backgroundColor: alpha("#FFFFFF", 0.96) }}>
            <Stack spacing={2.5}>
          <Box>
            <Typography variant="h4" fontWeight={600}>
              TechNovaAI Amazon iPhone Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Powered by Oxylabs Web Scraper API | Automated Hourly Data Pipeline
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Built by Chiao-Fan Yang | GitHub Repo:{" "}
              <Link
                href="https://github.com/ChiaoFan/oxylab_casestudy_poc"
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
              >
                https://github.com/ChiaoFan/oxylab_casestudy_poc
              </Link>
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button
              variant="contained"
              color="secondary"
              onClick={downloadJson}
              disabled={!data}
              sx={{ boxShadow: "0 8px 18px rgba(58, 168, 216, 0.28)" }}
            >
              Download JSON
            </Button>

            <Button
              variant="contained"
              color="secondary"
              onClick={() => void downloadMarkdownFile()}
              disabled={isDownloadingMarkdown}
              startIcon={isDownloadingMarkdown ? <CircularProgress size={14} /> : undefined}
              sx={{ boxShadow: "0 8px 18px rgba(18, 191, 179, 0.28)" }}
            >
              {isDownloadingMarkdown ? "Downloading…" : "Download Markdown"}
            </Button>
          </Stack>

          <Paper
            variant="outlined"
            sx={{ p: 2, borderRadius: 2, backgroundColor: alpha("#F8FCFE", 0.9), borderColor: alpha("#3AA8D8", 0.28) }}
          >
            <Stack spacing={1.25}>
              <Typography variant="body2" fontWeight={600}>
                Hourly Auto-Scraping with Oxylabs Scheduler
              </Typography>

              <Stack direction="row" spacing={0.75} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Status: <strong>{oxylabsSchedulerStatus?.active ? "Active" : "Paused"}</strong>
                </Typography>
                {isSchedulerScraping && (
                  <>
                    <CircularProgress size={12} thickness={5} color="primary" />
                    <Typography variant="caption" color="primary" fontWeight={600}>
                      Scraping…
                    </Typography>
                  </>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Last updated: <strong>{formatDateTime(data?.last_updated ?? null)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Next Oxylabs run: <strong>{formatDateTime(oxylabsSchedulerStatus?.nextRunAt ?? null)}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Schedule ID: <strong>{oxylabsSchedulerStatus?.scheduleId ?? "-"}</strong>
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  size="small"
                  variant={oxylabsSchedulerStatus?.active ? "outlined" : "contained"}
                  color={oxylabsSchedulerStatus?.active ? "error" : "primary"}
                  onClick={() => (oxylabsSchedulerStatus?.active ? void disableOxylabsScheduler() : void enableOxylabsScheduler())}
                  disabled={isTogglingOxylabsScheduler}
                  startIcon={isTogglingOxylabsScheduler ? <CircularProgress size={14} /> : undefined}
                >
                  {isTogglingOxylabsScheduler ? "Saving..." : oxylabsSchedulerStatus?.active ? "Disable" : "Enable"}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper
            variant="outlined"
            sx={{ p: 2, borderRadius: 2, backgroundColor: alpha("#F8FCFE", 0.9), borderColor: alpha("#6B8CA8", 0.2) }}
          >
            <Stack spacing={1.5}>
              <Typography variant="body2">
                Amazon marketplace: <strong>amazon.com</strong>
              </Typography>

              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2">
                  Postcode (Geo-location): <strong>{currentGeoLocation}</strong>
                </Typography>

                {!isEditingGeo ? (
                  <Button size="small" variant="outlined" color="secondary" onClick={() => setIsEditingGeo(true)}>
                    Edit
                  </Button>
                ) : (
                  <>
                    <TextField
                      size="small"
                      value={draftGeoLocation}
                      onChange={(event) => setDraftGeoLocation(event.target.value)}
                      placeholder={settings?.default_geo_location ?? "90210"}
                    />
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => void saveGeoLocation()}
                      disabled={isSavingGeo}
                      startIcon={isSavingGeo ? <CircularProgress size={14} /> : undefined}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      onClick={() => {
                        setDraftGeoLocation(settings?.geo_location ?? "");
                        setIsEditingGeo(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary">
                Enter a 5-digit ZIP from 00501 to 99950, or leave it blank for null.
              </Typography>
            </Stack>
          </Paper>

          {isLoading && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2">Loading latest scrape data…</Typography>
            </Stack>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!isLoading && !error && (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 2, maxHeight: 680, borderColor: alpha("#6B8CA8", 0.2), backgroundColor: "#FFFFFF" }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sortDirection={sortKey === "pos" ? sortDirection : false}>
                      <TableSortLabel
                        active={sortKey === "pos"}
                        direction={sortKey === "pos" ? sortDirection : "asc"}
                        onClick={() => handleSortClick("pos")}
                        sx={{
                          "& .MuiTableSortLabel-icon": {
                            opacity: 1,
                          },
                        }}
                      >
                        Position
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>ASIN</TableCell>
                    <TableCell sx={{ minWidth: 260 }}>Title</TableCell>
                    <TableCell sortDirection={sortKey === "price" ? sortDirection : false}>
                      <TableSortLabel
                        active={sortKey === "price"}
                        direction={sortKey === "price" ? sortDirection : "asc"}
                        onClick={() => handleSortClick("price")}
                        sx={{
                          "& .MuiTableSortLabel-icon": {
                            opacity: 1,
                          },
                        }}
                      >
                        Price
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={sortKey === "is_prime" ? sortDirection : false}>
                      <TableSortLabel
                        active={sortKey === "is_prime"}
                        direction={sortKey === "is_prime" ? sortDirection : "asc"}
                        onClick={() => handleSortClick("is_prime")}
                        sx={{
                          "& .MuiTableSortLabel-icon": {
                            opacity: 1,
                          },
                        }}
                      >
                        Prime
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={sortKey === "is_sponsored" ? sortDirection : false}>
                      <TableSortLabel
                        active={sortKey === "is_sponsored"}
                        direction={sortKey === "is_sponsored" ? sortDirection : "asc"}
                        onClick={() => handleSortClick("is_sponsored")}
                        sx={{
                          "& .MuiTableSortLabel-icon": {
                            opacity: 1,
                          },
                        }}
                      >
                        Sponsored
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>Delivery</TableCell>
                    <TableCell sx={{ minWidth: 300 }}>Description</TableCell>
                    <TableCell sx={{ minWidth: 320 }}>Product Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedProducts.map((product) => (
                    <TableRow
                      key={product.asin}
                      hover
                      sx={{
                        verticalAlign: "top",
                        "&:hover": { backgroundColor: alpha("#12BFB3", 0.06) },
                      }}
                    >
                      <TableCell>{product.pos}</TableCell>
                      <TableCell>{product.asin}</TableCell>
                      <TableCell>{product.title ?? "-"}</TableCell>
                      <TableCell>{formatPrice(product.price)}</TableCell>
                      <TableCell>{product.is_prime === null ? "-" : product.is_prime ? "Yes" : "No"}</TableCell>
                      <TableCell>{product.is_sponsored === null ? "-" : product.is_sponsored ? "Yes" : "No"}</TableCell>
                      <TableCell>{renderStructuredValue(product.delivery)}</TableCell>
                      <TableCell>{renderStructuredValue(product.description)}</TableCell>
                      <TableCell>{renderStructuredValue(product.product_details)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
            </Stack>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
