import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    database_url: Boolean(process.env.DATABASE_URL),
    session_secret: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32),
    database: false,
    schema: false,
  };
  try {
    const [row] = await db()<{ ok: number; users: string | null }[]>`select 1 as ok, to_regclass('public.users')::text as users`;
    checks.database = row?.ok === 1;
    checks.schema = Boolean(row?.users);
  } catch {
    // leave false
  }
  const ok = Object.values(checks).every(Boolean);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
