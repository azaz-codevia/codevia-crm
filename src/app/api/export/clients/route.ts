import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listClients, type ClientFilters } from "@/lib/queries";

export const dynamic = "force-dynamic";

function cell(v: unknown) {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(", ") : String(v);
  // Neutralise spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const filters = Object.fromEntries(new URL(request.url).searchParams) as ClientFilters;
  const { rows } = await listClients(filters, { all: true });
  const ids = rows.map((r) => r.id);

  const sql = db();
  const details = ids.length
    ? await sql<Record<string, unknown>[]>`
        select id, job_title, industry, company_size, website, budget_range, timeline, requirements,
               utm_source, utm_medium, tags, last_contacted_at
        from clients where id = any(${ids}::uuid[])`
    : [];
  const byId = new Map(details.map((d) => [d.id as string, d]));

  const columns: [string, (r: (typeof rows)[number]) => unknown][] = [
    ["Company", (r) => r.company_name],
    ["Contact", (r) => r.contact_name],
    ["Job title", (r) => byId.get(r.id)?.job_title],
    ["Email", (r) => r.email],
    ["Phone", (r) => r.phone],
    ["City", (r) => r.city],
    ["Industry", (r) => byId.get(r.id)?.industry],
    ["Company size", (r) => byId.get(r.id)?.company_size],
    ["Website", (r) => byId.get(r.id)?.website],
    ["Services", (r) => r.services],
    ["Budget", (r) => byId.get(r.id)?.budget_range],
    ["Timeline", (r) => byId.get(r.id)?.timeline],
    ["Requirements", (r) => byId.get(r.id)?.requirements],
    ["Status", (r) => r.status],
    ["Priority", (r) => r.priority],
    ["Lead score", (r) => r.lead_score],
    ["Deal value (SAR)", (r) => r.deal_value],
    ["Source", (r) => r.source],
    ["UTM source", (r) => byId.get(r.id)?.utm_source],
    ["UTM medium", (r) => byId.get(r.id)?.utm_medium],
    ["Campaign", (r) => r.utm_campaign],
    ["Tags", (r) => byId.get(r.id)?.tags],
    ["Owner", (r) => r.owner_name],
    ["Next follow-up", (r) => r.next_follow_up_at],
    ["Last contacted", (r) => byId.get(r.id)?.last_contacted_at],
    ["Created", (r) => r.created_at],
    ["CRM id", (r) => r.id],
  ];

  const lines = [columns.map(([h]) => cell(h)).join(","), ...rows.map((r) => columns.map(([, get]) => cell(get(r))).join(","))];
  const date = new Date().toISOString().slice(0, 10);
  // BOM so Excel opens Arabic text correctly
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="codevia-clients-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
