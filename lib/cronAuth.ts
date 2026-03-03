import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export function isAuthorizedCronRequest(request: NextRequest, scope: string): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV !== "production";

  if (!cronSecret) {
    logger.warn(scope, "CRON_SECRET is not set; allowing request");
    return true;
  }

  if (isDev && !authHeader) {
    logger.warn(scope, "No authorization header in development; allowing request");
    return true;
  }

  const authorized = authHeader === `Bearer ${cronSecret}`;
  if (!authorized) {
    logger.warn(scope, "Unauthorized request", {
      hasAuthHeader: Boolean(authHeader),
      cronSecretConfigured: Boolean(cronSecret),
    });
  }

  return authorized;
}
