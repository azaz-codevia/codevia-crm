import { db } from "@/lib/db";
import { buildCalendar, type IcalEvent } from "@/lib/ical";
import { dictionaries, isLocale } from "@/lib/i18n/dictionaries";
import { APP_TIMEZONE } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  starts_at: Date;
  ends_at: Date;
  status: "scheduled" | "completed" | "cancelled";
  sequence: number;
  updated_at: Date;
  client_id: string | null;
  client_name: string | null;
  contact_name: string | null;
  phone: string | null;
  owner_name: string | null;
};

function baseUrl(request: Request) {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

/** Subscribed calendar feed: /api/calendar/<token>.ics?scope=all|mine */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[0-9a-f]{32,128}$/i.test(token)) return new Response("Not found", { status: 404 });

  const sql = db();
  const [user] = await sql<{ id: string; locale: string }[]>`
    select id, locale from users where calendar_token = ${token} and is_active = true`;
  if (!user) return new Response("Not found", { status: 404 });

  const scope = new URL(request.url).searchParams.get("scope") === "mine" ? "mine" : "all";
  const locale = isLocale(user.locale) ? user.locale : "en";
  const t = dictionaries[locale];
  const base = baseUrl(request);

  const rows = await sql<Row[]>`
    select m.id, m.title, m.description, m.location, m.meeting_url, m.starts_at, m.ends_at, m.status, m.sequence, m.updated_at,
           m.client_id, coalesce(c.company_name, c.contact_name) as client_name, c.contact_name, c.phone, u.name as owner_name
    from meetings m
    left join clients c on c.id = m.client_id
    left join users u on u.id = m.owner_id
    where m.starts_at > now() - interval '120 days'
      and m.starts_at < now() + interval '400 days'
      ${scope === "mine" ? sql`and m.owner_id = ${user.id}` : sql``}
    order by m.starts_at
    limit 3000`;

  const events: IcalEvent[] = rows.map((m) => {
    const details = [
      m.client_name && `${t.calendar.client}: ${m.client_name}`,
      m.contact_name && m.contact_name !== m.client_name && m.contact_name,
      m.phone,
      m.owner_name && `${t.calendar.owner}: ${m.owner_name}`,
      m.meeting_url,
      m.description,
      m.client_id && `${base}/clients/${m.client_id}`,
    ].filter(Boolean);
    return {
      uid: `${m.id}@codevia-crm`,
      sequence: m.sequence,
      start: m.starts_at,
      end: m.ends_at,
      stamp: m.updated_at,
      summary: m.client_name && !m.title.includes(m.client_name) ? `${m.title} · ${m.client_name}` : m.title,
      description: details.join("\n"),
      location: m.location ?? m.meeting_url,
      url: m.meeting_url ?? (m.client_id ? `${base}/clients/${m.client_id}` : null),
      status: m.status,
      alarmMinutes: 30,
    };
  });

  const body = buildCalendar({
    name: scope === "mine" ? `Codevia CRM · ${t.tasks.mine}` : "Codevia CRM",
    description: t.app.tagline,
    timezone: APP_TIMEZONE,
    events,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="codevia-crm.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
