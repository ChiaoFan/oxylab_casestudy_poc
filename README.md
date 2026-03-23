# TechNovaAI Oxylabs Scraper

A Next.js application that scrapes Amazon iPhone listings using the Oxylabs API, stores structured JSON and Markdown outputs, and supports hourly scheduled scraping.

## Live Demo

**[https://d146lkgn1y9ka.cloudfront.net](https://d146lkgn1y9ka.cloudfront.net)**

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| UI | React 19, MUI (Material UI), Tailwind CSS |
| Scraping API | [Oxylabs](https://oxylabs.io/) (Amazon Search + Product) |
| Scheduling | node-cron (hourly sync worker) |
| Runtime | Node.js 24 |
| Containerization | Docker |
| Container Registry | Amazon ECR |
| Hosting | Amazon EC2 (eu-north-1) |
| CDN / HTTPS | Amazon CloudFront |

## Features

- Scrapes top 100 Amazon iPhone listings via Oxylabs push-pull integration
- Fetches per-product details (title, price, delivery, description, prime status)
- Generates structured JSON and Markdown output files
- Supports hourly automated scraping via Oxylabs Scheduler
- Configurable geo-location (ZIP code) for localized pricing
- Scheduler-only scraping workflow (manual `POST /api/scrape` is disabled)
- REST API: `GET /api/scrape` (latest results), `GET/POST /api/scrape/system` (scheduler status + enable/disable), `GET/POST /api/scrape/settings` (geo-location)
- Health check endpoint: `GET /api/health`

## Local Development

1. Create `.env` in the project root:

```bash
OXYLABS_USER=your_oxylabs_username
OXYLABS_PASS=your_oxylabs_password
```

2. Install dependencies and run:

```bash
npm ci
npm run dev
```

3. Open `http://localhost:3000`.

To use a custom port:

```bash
npm run dev -- -p 4000
```

## Docker

### Run locally

```bash
docker compose up -d --build
```

App will be available at `http://localhost:3000`.

To use a different host port:

```bash
HOST_PORT=4000 docker compose up -d --build
```

### Stop

```bash
docker compose down
```

## Output Files

Scrape results are saved under `output/`:

| File | Description |
|---|---|
| `json_latest.json` | Latest scrape results (JSON) |
| `json_<timestamp>.json` | Timestamped scrape snapshot |
| `markdown_latest.md` | Latest product markdown |
| `markdown_<timestamp>.md` | Timestamped markdown snapshot |
| `tecnovaai_settings.json` | Geo-location and scheduler settings |
