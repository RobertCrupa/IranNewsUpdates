// Shared TypeScript types used across components and API responses

export interface ArticleData {
  _id: string;
  title: string;
  url: string;
  source: string;
  content: string;
  publishedAt: string;
  category: "news" | "social";
  imageUrl?: string;
}

export interface SituationUpdateData {
  _id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  severity: "low" | "medium" | "high" | "critical";
  generatedAt: string;
  region: string;
}

export interface TravelAlertData {
  _id: string;
  country: string;
  city?: string;
  alertLevel: "green" | "yellow" | "amber" | "red";
  title: string;
  description: string;
  advice: string[];
  embassyContact?: string;
  embassyWebsite?: string;
  updatedAt: string;
}
