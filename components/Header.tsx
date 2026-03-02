"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function Header() {
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600">
            <span className="text-xs font-bold text-white">IR</span>
          </div>
          <div>
            <Link href="/" className="text-lg font-bold tracking-tight text-white">
              IranNewsUpdates
            </Link>
            <p className="text-xs text-zinc-500">Live Middle East Situation Monitor</p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link href="#updates" className="text-zinc-400 transition hover:text-white">
            Updates
          </Link>
          <Link href="#news" className="text-zinc-400 transition hover:text-white">
            News
          </Link>
          <Link href="#travel" className="text-zinc-400 transition hover:text-white">
            Travel Alerts
          </Link>
        </nav>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          {lastUpdated ? `Last updated ${lastUpdated}` : "Live"}
        </div>
      </div>
    </header>
  );
}
