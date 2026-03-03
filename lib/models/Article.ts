import mongoose, { Schema, Document, Model } from "mongoose";
import { LEGACY_CATEGORIES, OFFICIAL_CATEGORIES, type ArticleCategory } from "@/lib/sources";

export interface IArticle extends Document {
  title: string;
  url: string;
  source: string;
  content: string;
  summary: string;
  publishedAt: Date;
  scrapedAt: Date;
  category: ArticleCategory;
  tags: string[];
  imageUrl?: string;
  country?: string;
}

const ArticleSchema = new Schema<IArticle>(
  {
    title: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    content: { type: String, default: "" },
    summary: { type: String, default: "" },
    publishedAt: { type: Date, required: true },
    scrapedAt: { type: Date, default: Date.now },
    category: {
      type: String,
      enum: [...OFFICIAL_CATEGORIES, ...LEGACY_CATEGORIES],
      default: "government",
    },
    tags: { type: [String], default: [] },
    imageUrl: { type: String },
    country: { type: String },
  },
  { timestamps: true }
);

ArticleSchema.index({ publishedAt: -1 });
ArticleSchema.index({ category: 1, publishedAt: -1 });

const Article: Model<IArticle> =
  mongoose.models.Article ?? mongoose.model<IArticle>("Article", ArticleSchema);

export default Article;
