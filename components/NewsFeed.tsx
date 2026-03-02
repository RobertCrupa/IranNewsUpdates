"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "@/lib/formatDate";
import type { ArticleData } from "@/lib/types";

interface Props {
  initialArticles?: ArticleData[];
}

const sourceColors: Record<string, string> = {
  "bbc.com": "bg-red-900/30 text-red-400",
  "reuters.com": "bg-orange-900/30 text-orange-400",
  "apnews.com": "bg-blue-900/30 text-blue-400",
  "aljazeera.com": "bg-green-900/30 text-green-400",
  "x.com": "bg-sky-900/30 text-sky-400",
};

export default function NewsFeed({ initialArticles = [] }: Props) {
  const [articles, setArticles] = useState<ArticleData[]>(initialArticles);
  const [filter, setFilter] = useState<"all" | "news" | "social">("all");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchArticles = useCallback(
    async (newPage: number, newFilter: typeof filter, reset: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(newPage),
          limit: "20",
          ...(newFilter !== "all" && { category: newFilter }),
        });
        const res = await fetch(`/api/news?${params}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          articles: ArticleData[];
          pagination: { totalPages: number };
        };
        setArticles((prev) => (reset ? data.articles : [...prev, ...data.articles]));
        setHasMore(newPage < data.pagination.totalPages);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setPage(1);
    void fetchArticles(1, newFilter, true);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchArticles(nextPage, filter, false);
  };

  useEffect(() => {
    // Refresh every 2 minutes
    const interval = setInterval(() => {
      void fetchArticles(1, filter, true);
      setPage(1);
    }, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [filter, fetchArticles]);

  const getSourceColor = (source: string) =>
    sourceColors[source] ?? "bg-zinc-800 text-zinc-400";

  return (
    <section id="news" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Live News Feed</h2>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
          {(["all", "news", "social"] as const).map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                filter === f
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {articles.length === 0 && !loading && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-sm text-zinc-500">No articles yet.</p>
            <p className="mt-1 text-xs text-zinc-600">
              Trigger a scrape using the admin API to populate news.
            </p>
          </div>
        )}

        {articles.map((article) => (
          <article
            key={article._id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${getSourceColor(article.source)}`}>
                  {article.source}
                </span>
                {article.category === "social" && (
                  <span className="rounded bg-sky-900/30 px-2 py-0.5 text-xs text-sky-400">
                    𝕏 Post
                  </span>
                )}
              </div>
              <span className="shrink-0 text-xs text-zinc-600">
                {formatDistanceToNow(article.publishedAt)}
              </span>
            </div>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <h3 className="text-sm font-medium text-zinc-200 transition group-hover:text-white">
                {article.title}
              </h3>
              {article.content && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                  {article.content}
                </p>
              )}
            </a>
          </article>
        ))}
      </div>

      {hasMore && articles.length > 0 && (
        <button
          onClick={handleLoadMore}
          disabled={loading}
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-sm text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more articles"}
        </button>
      )}
    </section>
  );
}
