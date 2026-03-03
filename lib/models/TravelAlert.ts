import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITravelAlert extends Document {
  country: string;
  city?: string;
  alertLevel: "green" | "yellow" | "amber" | "red";
  title: string;
  description: string;
  advice: string[];
  embassyContact?: string;
  embassyWebsite?: string;
  updatedAt: Date;
  isActive: boolean;
}

const TravelAlertSchema = new Schema<ITravelAlert>(
  {
    country: { type: String, required: true },
    city: { type: String },
    alertLevel: {
      type: String,
      enum: ["green", "yellow", "amber", "red"],
      default: "yellow",
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    advice: { type: [String], default: [] },
    embassyContact: { type: String },
    embassyWebsite: { type: String },
    updatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TravelAlertSchema.index({ country: 1, alertLevel: 1 });

const TravelAlert: Model<ITravelAlert> =
  mongoose.models.TravelAlert ??
  mongoose.model<ITravelAlert>("TravelAlert", TravelAlertSchema);

export default TravelAlert;
