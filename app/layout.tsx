import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IranNewsUpdates — Live Middle East Situation Monitor",
  description:
    "Real-time news, AI-generated situation updates, and travel alerts for the Iran conflict and Middle East region. Stay informed with live updates from trusted sources.",
  openGraph: {
    title: "IranNewsUpdates — Live Middle East Situation Monitor",
    description:
      "Real-time news and AI-generated situation updates for the Iran conflict and Middle East region.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
