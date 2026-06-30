import type { NextRequest } from "next/server";
import { env } from "./env";

/**
 * Build the base URL (scheme + host) from the incoming request.
 *
 * The session cookie is host-scoped (no Domain attribute), so the OAuth
 * callback and any post-flow redirects must target the *same* host that served
 * the request — otherwise the request-token cookie set when the flow starts is
 * not sent back to the callback. Deriving the origin per-request keeps the
 * cookie host and the callback host in sync no matter which hostname the user
 * arrived on (custom domain, apex vs. www, herokuapp.com, etc.).
 *
 * On Heroku the router sets `x-forwarded-host`/`x-forwarded-proto` and strips
 * any client-provided values, so these headers are trustworthy here. Falls back
 * to the configured APP_BASE_URL when no host header is present.
 */
export function requestBaseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) {
    return env.appBaseUrl;
  }
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto?.split(",")[0].trim() ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}
