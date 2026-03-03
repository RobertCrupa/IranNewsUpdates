import Header from "@/components/Header";
import LiveTicker from "@/components/LiveTicker";
import SituationSummary from "@/components/SituationSummary";
import NewsFeed from "@/components/NewsFeed";
import TravelInfo from "@/components/TravelInfo";
import type { ArticleData, SituationUpdateData, TravelAlertData } from "@/lib/types";

// Server-side data fetching for initial render
async function getInitialData() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  const [newsRes, updatesRes, travelRes] = await Promise.allSettled([
    fetch(`${baseUrl}/api/news?limit=20`, { next: { revalidate: 120 } }),
    fetch(`${baseUrl}/api/updates`, { next: { revalidate: 120 } }),
    fetch(`${baseUrl}/api/travel`, { next: { revalidate: 300 } }),
  ]);

  const articles: ArticleData[] =
    newsRes.status === "fulfilled" && newsRes.value.ok
      ? ((await newsRes.value.json()) as { articles: ArticleData[] }).articles
      : [];

  const updates: SituationUpdateData[] =
    updatesRes.status === "fulfilled" && updatesRes.value.ok
      ? ((await updatesRes.value.json()) as { updates: SituationUpdateData[] }).updates
      : [];

  const travelAlerts: TravelAlertData[] =
    travelRes.status === "fulfilled" && travelRes.value.ok
      ? ((await travelRes.value.json()) as { alerts: TravelAlertData[] }).alerts
      : [];

  return { articles, updates, travelAlerts };
}

export default async function Home() {
  const { articles, updates, travelAlerts } = await getInitialData();

  const latestUpdate: SituationUpdateData | null = updates[0] ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Header />
      <LiveTicker articles={articles} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Middle East Situation Monitor
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Live news aggregation, AI-powered situation briefings, and travel safety information
            for the Iran conflict and affected countries.
          </p>
        </div>

        {/* Two-column layout on large screens */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content — 2/3 width */}
          <div className="space-y-6 lg:col-span-2">
            <SituationSummary initialUpdate={latestUpdate} />
            <NewsFeed initialArticles={articles} />
          </div>

          {/* Sidebar — 1/3 width */}
          <aside className="space-y-6">
            <TravelInfo alerts={travelAlerts} />

            {/* Quick links */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h3 className="mb-3 text-sm font-semibold text-white">Official Resources</h3>
              <ul className="space-y-2">
                {[
                  {
                    label: "UK FCDO Travel Advice",
                    url: "https://www.gov.uk/foreign-travel-advice",
                  },
                  {
                    label: "US State Dept. Alerts",
                    url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html/",
                  },
                  {
                    label: "IATA Flight Status",
                    url: "https://www.iata.org/en/programs/safety/",
                  },
                  {
                    label: "UNHCR Refugee Info",
                    url: "https://www.unhcr.org/middle-east",
                  },
                ].map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-zinc-400 transition hover:text-white"
                    >
                      <span className="h-1 w-1 rounded-full bg-zinc-600" />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4">
              <p className="text-xs leading-relaxed text-zinc-600">
                <span className="font-medium text-zinc-500">Disclaimer:</span> This platform
                aggregates publicly available information. Always verify information with official
                government sources. In an emergency, contact your local embassy immediately.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <footer className="mt-16 border-t border-zinc-800 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-zinc-600 sm:px-6">
          IranNewsUpdates · Aggregated from public news sources · Updated continuously
        </div>
      </footer>
    </div>
  );
}
