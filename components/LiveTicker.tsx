"use client";

import { useEffect, useRef, useState } from "react";

import type { ArticleData } from "@/lib/types";

interface LiveTickerProps {
  articles: ArticleData[];
}

export default function LiveTicker({ articles }: LiveTickerProps) {
  const [items, setItems] = useState<ArticleData[]>(articles);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(articles);
  }, [articles]);

  if (items.length === 0) return null;

  const tickerContent = items.map((a) => a.title).join("  ·  ");

  return (
    <div className="overflow-hidden border-b border-zinc-800 bg-red-900/20 py-2">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6">
        <span className="shrink-0 rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-white">
          Breaking
        </span>
        <div ref={containerRef} className="overflow-hidden">
          <p className="animate-marquee whitespace-nowrap text-sm text-zinc-300">
            {tickerContent}
          </p>
        </div>
      </div>
    </div>
  );
}
