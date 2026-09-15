import { headers } from "next/headers";

/** Public base URL: APP_URL env, else derived from the incoming request (works on Vercel previews). */
export async function getAppUrl() {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function calendarFeedUrls(base: string, token: string) {
  const path = `/api/calendar/${token}.ics`;
  const https = `${base}${path}`;
  const webcal = https.replace(/^https?:\/\//, "webcal://");
  return {
    all: { https, webcal },
    mine: { https: `${https}?scope=mine`, webcal: `${webcal}?scope=mine` },
  };
}

export type FeedUrls = ReturnType<typeof calendarFeedUrls>;
