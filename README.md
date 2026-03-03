# IranNewsUpdates

A modern, real-time Next.js application that serves as a central information hub for news and live updates about the Iran conflict and Middle East situation, including travel alerts for people stranded in affected countries.

## Features

- **Live News Feed** — Aggregates articles from BBC, Reuters, AP News, Al Jazeera via Apify web scrapers
- **X (Twitter) Monitoring** — Scrapes relevant posts using the Apify Twitter Scraper actor
- **AI-Powered Situation Updates** — Uses OpenAI GPT-4o-mini to generate situation briefings from the latest articles, automatically every 15 minutes
- **Travel Alerts** — Country-level safety information (UAE, Iran, Israel + more via DB)
- **MongoDB Storage** — All scraped articles and generated updates are persisted in MongoDB
- **Auto-refresh UI** — News feed refreshes every 2 minutes; situation update panel polls every 15 minutes and always shows when the last update was generated
- **Dark, minimalist UI** — Built with Tailwind CSS v4

## Tech Stack

| Layer     | Technology                |
| --------- | ------------------------- |
| Framework | Next.js 16 (App Router)   |
| Language  | TypeScript                |
| Styling   | Tailwind CSS v4           |
| Database  | MongoDB via Mongoose      |
| Scraping  | Apify (Cheerio + Twitter) |
| AI/LLM    | OpenAI GPT-4o-mini        |

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

| Variable               | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `MONGODB_URI`          | MongoDB connection string (Atlas recommended)                              |
| `APIFY_API_TOKEN`      | Apify API token from console.apify.com                                     |
| `OPENAI_API_KEY`       | OpenAI API key from platform.openai.com                                    |
| `CRON_SECRET`          | Secret used by Vercel Cron to authenticate the `/api/cron/update` endpoint |
| `NEXT_PUBLIC_BASE_URL` | Your deployed URL (default: http://localhost:3000)                         |
| `LOG_LEVEL`            | Optional log level (`debug`, `info`, `warn`, `error`)                      |

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Local ingestion trigger (important)

In local development, Vercel Cron does not run automatically, so the database will remain empty until you trigger ingestion.

Run this once after starting the app:

```bash
curl -i http://localhost:3000/api/cron/update
```

In development mode, the cron/scrape/update write endpoints accept requests without the auth header to simplify local testing. In production, `CRON_SECRET` auth is enforced.

## API Routes

| Route              | Method | Description                                                                                                                                                                         |
| ------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/news`        | GET    | Fetch paginated news articles (`?page=1&limit=20&category=news\|social`)                                                                                                            |
| `/api/travel`      | GET    | Fetch active travel alerts                                                                                                                                                          |
| `/api/updates`     | GET    | Fetch latest AI-generated situation updates                                                                                                                                         |
| `/api/cron/update` | GET    | **Cron endpoint** — scrapes news + generates a situation update. Called automatically every 15 minutes by Vercel Cron. Auth required in production; local dev allows no-auth calls. |
| `/api/scrape`      | POST   | Manually trigger Apify scraping only (`type: "all"\|"news"\|"social"`). Auth required in production; local dev allows no-auth calls.                                                |

## Automated Updates (Vercel Cron)

The `vercel.json` at the root of the project configures a Vercel Cron Job that calls `GET /api/cron/update` every 15 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/update",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Each run:

1. Scrapes fresh articles from BBC, Reuters, AP News, Al Jazeera, and X
2. Generates a new AI situation briefing from the articles collected in that run
3. Persists both to MongoDB

The UI polls `/api/updates` every 15 minutes in the background and always displays **"Updated X ago"** so users know exactly how fresh the current briefing is.

## Project Structure

```
├── vercel.json                     # Vercel Cron Job config (every 15 min)
├── app/
│   ├── api/
│   │   ├── cron/update/route.ts    # Cron endpoint: scrape + generate update
│   │   ├── news/route.ts           # News fetch API
│   │   ├── scrape/route.ts         # Manual Apify scraping trigger
│   │   ├── travel/route.ts         # Travel alerts API
│   │   └── updates/route.ts        # Situation updates read API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Main dashboard
├── components/
│   ├── Header.tsx
│   ├── LiveTicker.tsx              # Breaking news ticker
│   ├── NewsFeed.tsx                # Live news list with filtering
│   ├── SituationSummary.tsx        # AI-generated briefing panel (read-only, shows "Updated X ago")
│   └── TravelInfo.tsx              # Country-level travel alerts
└── lib/
    ├── apify.ts                    # Apify scraping helpers
    ├── db.ts                       # MongoDB connection
    ├── formatDate.ts               # Date utility
    ├── openai.ts                   # OpenAI generation helper
    ├── types.ts                    # Shared TypeScript interfaces
    └── models/
        ├── Article.ts              # News article schema
        ├── SituationUpdate.ts      # AI update schema
        └── TravelAlert.ts          # Travel alert schema
```
