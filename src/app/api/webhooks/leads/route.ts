import type postgres from "postgres";
import { db } from "@/lib/db";
import { hashApiKey } from "@/lib/api-keys";
import { isSource } from "@/lib/constants";
import { hasIdentity, normalizeLead, unwrapPayload, upsertLead } from "@/lib/leads";

export const dynamic = "force-dynamic";

const MAX_BODY = 256 * 1024;

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const allowed = (process.env.WEBHOOK_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

/** GET with a key: lets Zapier/Make "test connection" without creating a lead. */
export async function GET(request: Request) {
  const key = extractKey(request);
  if (!key) return json(request, { ok: false, error: "missing_api_key" }, 401);
  const [apiKey] = await db()<{ name: string; default_source: string }[]>`
    select name, default_source from api_keys where key_hash = ${hashApiKey(key)} and revoked_at is null`;
  if (!apiKey) return json(request, { ok: false, error: "invalid_api_key" }, 401);
  return json(request, { ok: true, key: apiKey.name, source: apiKey.default_source });
}

async function readBody(request: Request): Promise<Record<string, unknown> | Record<string, unknown>[] | null> {
  const type = request.headers.get("content-type") ?? "";
  const raw = await request.text();
  if (raw.length > MAX_BODY) return null;
  if (type.includes("application/x-www-form-urlencoded")) {
    return groupForm(new URLSearchParams(raw));
  }
  if (type.includes("multipart/form-data")) {
    const fd = await new Response(raw, { headers: { "content-type": type } }).formData();
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (typeof v === "string") params.append(k, v);
    return groupForm(params);
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((x) => x && typeof x === "object" && !Array.isArray(x));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Repeated form keys (services=erp&services=web_app) become arrays. */
function groupForm(params: URLSearchParams) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key.replace(/\[\]$/, "")] = all.length > 1 ? all : all[0];
  }
  return out;
}

function extractKey(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-api-key")?.trim() || new URL(request.url).searchParams.get("key")?.trim() || null;
}

/**
 * POST /api/webhooks/leads
 * Auth: `Authorization: Bearer cvk_…` (or X-API-Key header, or ?key= for tools that can't set headers)
 * Body: JSON, form-encoded or multipart. Field names are matched loosely (EN + AR).
 */
export async function POST(request: Request) {
  const sql = db();
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const key = extractKey(request);
  if (!key) return json(request, { ok: false, error: "missing_api_key" }, 401);

  const [apiKey] = await sql<{ id: string; default_source: string }[]>`
    select id, default_source from api_keys where key_hash = ${hashApiKey(key)} and revoked_at is null`;
  if (!apiKey) return json(request, { ok: false, error: "invalid_api_key" }, 401);

  const log = (outcome: string, payload: unknown, clientId: string | null, error: string | null) =>
    sql`insert into webhook_logs (api_key_id, outcome, client_id, payload, error, ip)
        values (${apiKey.id}, ${outcome}, ${clientId}, ${payload == null ? null : sql.json(payload as postgres.JSONValue)}, ${error}, ${ip})`;

  const body = await readBody(request);
  if (!body) {
    await log("rejected", null, null, "invalid_body");
    return json(request, { ok: false, error: "invalid_body" }, 400);
  }

  if (Array.isArray(body)) {
    if (body.length === 0 || body.length > 100) {
      await log("rejected", null, null, "batch_size");
      return json(request, { ok: false, error: "batch_size", message: "Send 1–100 leads per request." }, 400);
    }
    const results = [];
    for (const item of body) results.push(await processOne(item, apiKey, ip, log));
    await sql`update api_keys set last_used_at = now() where id = ${apiKey.id}`;
    return json(request, { ok: results.every((r) => r.ok), results }, 207);
  }

  const result = await processOne(body, apiKey, ip, log);
  await sql`update api_keys set last_used_at = now() where id = ${apiKey.id}`;
  const status = result.ok ? (result.outcome === "created" ? 201 : 200) : result.error === "missing_identity" ? 422 : 500;
  return json(request, result, status);
}

type Logger = (outcome: string, payload: unknown, clientId: string | null, error: string | null) => Promise<unknown>;

async function processOne(body: Record<string, unknown>, apiKey: { id: string; default_source: string }, ip: string | null, log: Logger) {
  // Honeypot fields commonly used by forms: bots fill them, humans never see them
  if (body._gotcha || body.honeypot || body.website_hp) {
    await log("rejected", body, null, "honeypot");
    return { ok: true as const, outcome: "ignored" as const };
  }
  try {
    const lead = normalizeLead(unwrapPayload(body));
    if (!hasIdentity(lead)) {
      await log("rejected", body, null, "missing_identity");
      return { ok: false as const, error: "missing_identity", message: "Send at least one of company, name, email or phone." };
    }
    const source = isSource(apiKey.default_source) ? apiKey.default_source : "discovery";
    const result = await upsertLead(db(), lead, { userId: null, source, onDuplicate: "fill", activityType: "webhook", activityData: { ip } });
    const outcome = result.outcome === "skipped" ? ("updated" as const) : result.outcome;
    await log(outcome, body, result.id, null);
    return { ok: true as const, id: result.id, outcome };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 300) : "error";
    await log("error", body, null, message).catch(() => {});
    return { ok: false as const, error: "server_error" };
  }
}
