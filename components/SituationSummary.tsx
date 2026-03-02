"use client";

import { useCallback, useEffect, useState } from "react";
import type { SituationUpdateData } from "@/lib/types";

const severityConfig = {
  low: { label: "Low", className: "bg-green-900/40 text-green-400 border-green-700" },
  medium: { label: "Elevated", className: "bg-yellow-900/40 text-yellow-400 border-yellow-700" },
  high: { label: "High", className: "bg-orange-900/40 text-orange-400 border-orange-700" },
  critical: { label: "Critical", className: "bg-red-900/40 text-red-400 border-red-700" },
};

interface Props {
  initialUpdate?: SituationUpdateData | null;
}

export default function SituationSummary({ initialUpdate }: Props) {
  const [update, setUpdate] = useState<SituationUpdateData | null>(initialUpdate ?? null);
  const [loading, setLoading] = useState(false);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/updates");
      if (!res.ok) return;
      const data = (await res.json()) as { updates: SituationUpdateData[] };
      if (data.updates?.length > 0) setUpdate(data.updates[0]);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchLatest, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  const handleGenerateUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/updates", { method: "POST" });
      if (res.ok) {
        await fetchLatest();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const severity = update?.severity ?? "medium";
  const config = severityConfig[severity];

  return (
    <section id="updates" className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Situation Update</h2>
          {update && (
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
              {config.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {update && (
            <span className="text-xs text-zinc-500">
              {new Date(update.generatedAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={handleGenerateUpdate}
            disabled={loading}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate Update"}
          </button>
        </div>
      </div>

      {update ? (
        <div className="space-y-4">
          <h3 className="font-medium text-white">{update.title}</h3>
          <p className="text-sm leading-relaxed text-zinc-400">{update.summary}</p>
          {update.keyPoints.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Key Developments
              </h4>
              <ul className="space-y-1.5">
                {update.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="mb-3 text-sm text-zinc-500">
            No situation update available yet.
          </p>
          <p className="text-xs text-zinc-600">
            Click &quot;Generate Update&quot; to create an AI-powered summary from the latest news.
          </p>
        </div>
      )}
    </section>
  );
}
