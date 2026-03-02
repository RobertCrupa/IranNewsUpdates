"use client";

import { useCallback, useEffect, useState } from "react";
import type { SituationUpdateData } from "@/lib/types";
import { formatDistanceToNow } from "@/lib/formatDate";

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
  // Tick every minute so the relative "last updated" label stays current
  const [tick, setTick] = useState(0);
  void tick; // used only to trigger re-renders

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/updates");
      if (!res.ok) return;
      const data = (await res.json()) as { updates: SituationUpdateData[] };
      if (data.updates?.length > 0) setUpdate(data.updates[0]);
    } catch {
      // ignore network errors silently
    }
  }, []);

  useEffect(() => {
    // Poll for a new update every 15 minutes (matching the cron interval)
    const dataInterval = setInterval(fetchLatest, 15 * 60 * 1000);
    // Re-render every minute so the relative timestamp stays fresh
    const tickInterval = setInterval(() => setTick((t) => t + 1), 60 * 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(tickInterval);
    };
  }, [fetchLatest]);

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
        {update && (
          <span className="text-xs text-zinc-500">
            Updated {formatDistanceToNow(update.generatedAt)}
          </span>
        )}
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
          <p className="mb-2 text-sm text-zinc-500">No situation update available yet.</p>
          <p className="text-xs text-zinc-600">
            Updates are generated automatically every 15 minutes.
          </p>
        </div>
      )}
    </section>
  );
}
