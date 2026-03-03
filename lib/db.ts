import mongoose from "mongoose";
import { logger } from "@/lib/logger";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    logger.error("db", "MONGODB_URI is missing");
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  if (cached.conn && cached.conn.connection.readyState === 1) {
    logger.debug("db", "Using cached MongoDB connection");
    return cached.conn;
  }

  if (cached.conn && cached.conn.connection.readyState !== 1) {
    logger.warn("db", "Cached MongoDB connection is not ready; reconnecting", {
      readyState: cached.conn.connection.readyState,
    });
    cached.conn = null;
  }

  if (!cached.promise) {
    logger.info("db", "Opening new MongoDB connection", {
      nodeEnv: process.env.NODE_ENV,
    });
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
        family: 4,
      })
      .catch((error) => {
        cached.promise = null;
        logger.error("db", "MongoDB connect() failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      });
  }

  cached.conn = await cached.promise;
  if (cached.conn.connection.readyState !== 1) {
    logger.error("db", "MongoDB connect resolved but connection is not ready", {
      readyState: cached.conn.connection.readyState,
    });
    cached.conn = null;
    cached.promise = null;
    throw new Error("MongoDB connection is not ready");
  }

  logger.info("db", "MongoDB connected", {
    host: cached.conn.connection.host,
    dbName: cached.conn.connection.name,
    readyState: cached.conn.connection.readyState,
  });
  return cached.conn;
}
