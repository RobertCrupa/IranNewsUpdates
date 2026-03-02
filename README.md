# IranNewsUpdates

A modern, real-time Next.js application that serves as a central information hub for news and live updates about the Iran conflict and Middle East situation, including travel alerts for people stranded in affected countries.

## Features

- **Live News Feed** — Aggregates articles from BBC, Reuters, AP News, Al Jazeera via Apify web scrapers
- **X (Twitter) Monitoring** — Scrapes relevant posts using the Apify Twitter Scraper actor
- **AI-Powered Situation Updates** — Uses OpenAI GPT-4o-mini to generate hourly situation briefings from the latest articles
- **Travel Alerts** — Country-level safety information (UAE, Iran, Israel + more via DB)
- **MongoDB Storage** — All scraped articles and generated updates are persisted in MongoDB
- **Auto-refresh UI** — News feed refreshes every 2 minutes, situation updates every 5 minutes
- **Dark, minimalist UI** — Built with Tailwind CSS v4

## Tech Stack

| Layer      | Technology                    |
|------------|-------------------------------|
| Framework  | Next.js 16 (App Router)       |
| Language   | TypeScript                    |
| Styling    | Tailwind CSS v4               |
| Database   | MongoDB via Mongoose          |
| Scraping   | Apify (Cheerio + Twitter)     |
| AI/LLM     | OpenAI GPT-4o-mini            |

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

| Variable               | Description                                    |
|------------------------|------------------------------------------------|
| `MONGODB_URI`          | MongoDB connection string (Atlas recommended)  |
| `APIFY_API_TOKEN`      | Apify API token from console.apify.com         |
| `OPENAI_API_KEY`       | OpenAI API key from platform.openai.com        |
| `CRON_SECRET`          | Optional secret to protect scrape endpoints    |
| `NEXT_PUBLIC_BASE_URL` | Your deployed URL (default: http://localhost:3000) |

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## API Routes

| Route            | Method | Description                                          |
|------------------|--------|------------------------------------------------------|
| `/api/news`      | GET    | Fetch paginated news articles (`?page=1&limit=20&category=news|social`) |
| `/api/travel`    | GET    | Fetch active travel alerts                          |
| `/api/updates`   | GET    | Fetch latest AI-generated situation updates          |
| `/api/updates`   | POST   | Trigger a new AI situation update (requires `Authorization: Bearer <CRON_SECRET>`) |
| `/api/scrape`    | POST   | Trigger Apify scraping (`type: "all"|"news"|"social"`, requires `Authorization: Bearer <CRON_SECRET>`) |

## Automated Scraping & Updates

To keep the app current, set up a cron job (e.g., via [Vercel Cron](https://vercel.com/docs/cron-jobs)) to call the scrape and update endpoints periodically:

```bash
# Scrape news every hour
POST /api/scrape
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json
{"type": "all"}

# Generate situation update after scraping
POST /api/updates
Authorization: Bearer <CRON_SECRET>
```

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── news/route.ts       # News fetch API
│   │   ├── scrape/route.ts     # Apify scraping trigger
│   │   ├── travel/route.ts     # Travel alerts API
│   │   └── updates/route.ts    # Situation updates API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Main dashboard
├── components/
│   ├── Header.tsx
│   ├── LiveTicker.tsx          # Breaking news ticker
│   ├── NewsFeed.tsx            # Live news list with filtering
│   ├── SituationSummary.tsx    # AI-generated briefing panel
│   └── TravelInfo.tsx          # Country-level travel alerts
└── lib/
    ├── apify.ts                # Apify scraping helpers
    ├── db.ts                   # MongoDB connection
    ├── formatDate.ts           # Date utility
    ├── openai.ts               # OpenAI generation helper
    └── models/
        ├── Article.ts          # News article schema
        ├── SituationUpdate.ts  # AI update schema
        └── TravelAlert.ts      # Travel alert schema
```
