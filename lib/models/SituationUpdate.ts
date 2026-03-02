import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISituationUpdate extends Document {
  title: string;
  summary: string;
  keyPoints: string[];
  generatedAt: Date;
  sourceArticleIds: mongoose.Types.ObjectId[];
  severity: "low" | "medium" | "high" | "critical";
  region: string;
}

const SituationUpdateSchema = new Schema<ISituationUpdate>(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
    keyPoints: { type: [String], default: [] },
    generatedAt: { type: Date, default: Date.now },
    sourceArticleIds: [{ type: Schema.Types.ObjectId, ref: "Article" }],
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    region: { type: String, default: "Middle East" },
  },
  { timestamps: true }
);

SituationUpdateSchema.index({ generatedAt: -1 });

const SituationUpdate: Model<ISituationUpdate> =
  mongoose.models.SituationUpdate ??
  mongoose.model<ISituationUpdate>("SituationUpdate", SituationUpdateSchema);

export default SituationUpdate;
