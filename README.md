# TechNovaAI Oxylabs Scraper (Next.js)

This app scrapes Amazon iPhone listings using Oxylabs, stores outputs under `output/`, and includes an Oxylabs scheduler sync worker.

## Local development

1. Create `.env.local`:

```bash
OXYLABS_USER=your_oxylabs_username
OXYLABS_PASS=your_oxylabs_password
```

2. Install and run:

```bash
npm ci
npm run dev
```

3. Open `http://localhost:3000`.
