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
| Scraping API | [Oxylabs Web Scraper API](https://developers.oxylabs.io/scraping-solutions/web-scraper-api) |
| Runtime | Node.js 24 |
| Containerization | Docker |
| Hosting | Amazon EC2 |
| CDN / HTTPS | Amazon CloudFront |

## Features

- Oxylabs Scheduler: Supports hourly automated scraping
- Localization (Geo-location): For localized U.S. pricing.
- Dedicated Parsers & Markdown Output: For instant, structured JSON and Markdown
- Push-Pull Integration: Decoupled Asynchronous Workflows for Zero Idle Load. 
- Oxylabs Usage Statistics: To monitor the total volume of requests

- REST API:
  - `GET /api/scrape` — Latest saved scrape results
  - `GET /api/scrape/usage` — Oxylabs usage stats (all_count, average_response_time for web_scraper_api)
  - `GET/POST /api/scrape/system` — Scheduler status + enable/disable
  - `GET/POST /api/scrape/settings` — Geo-location (ZIP code) configuration
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


## Docker

### Run locally

```bash
docker compose up -d --build
```

App will be available at `http://localhost:3000`.


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
