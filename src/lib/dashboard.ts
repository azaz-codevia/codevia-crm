import { db } from "./db";
import { OPEN_STATUSES } from "./constants";
import { APP_TIMEZONE } from "./utils";
import type { MeetingRow, TaskRow } from "./queries";

export type Range = "30" | "90" | "365" | "all";

export function parseRange(v: string | undefined): Range {
  return v === "90" || v === "365" || v === "all" ? v : "30";
}

export async function getDashboard(range: Range, userId: string) {
  const sql = db();
  const days = range === "all" ? null : Number(range);
  const since = days ? new Date(Date.now() - days * 86400_000) : new Date(0);
  const prevSince = days ? new Date(Date.now() - 2 * days * 86400_000) : new Date(0);
  const inRange = sql`c.created_at >= ${since}`;
  const tz = APP_TIMEZONE;

  // Trend buckets: daily for 30d, weekly for 90d, monthly otherwise
  const bucket = range === "30" ? "day" : range === "90" ? "week" : "month";
  const trendStart = range === "all" ? new Date(Date.now() - 365 * 86400_000) : since;
  const step = bucket === "day" ? "1 day" : bucket === "week" ? "1 week" : "1 month";

  const [
    [kpi],
    trend,
    bySource,
    byStage,
    byService,
    byCampaign,
    team,
    upcoming,
    dueTasks,
    recent,
  ] = await Promise.all([
    sql<{
      pipeline_value: number;
      open_deals: number;
      new_leads: number;
      prev_leads: number;
      won_value: number;
      won_count: number;
      closed_won: number;
      closed_lost: number;
      unassigned: number;
      avg_score: number | null;
      meetings_week: number;
      overdue_tasks: number;
    }[]>`
      select
        (select coalesce(sum(deal_value), 0) from clients where status = any(${OPEN_STATUSES}::text[])) as pipeline_value,
        (select count(*)::int from clients where status = any(${OPEN_STATUSES}::text[])) as open_deals,
        (select count(*)::int from clients c where ${inRange}) as new_leads,
        (select count(*)::int from clients where created_at >= ${prevSince} and created_at < ${since}) as prev_leads,
        (select coalesce(sum(deal_value), 0) from clients where status = 'won' and coalesce(won_at, updated_at) >= ${since}) as won_value,
        (select count(*)::int from clients where status = 'won' and coalesce(won_at, updated_at) >= ${since}) as won_count,
        (select count(*)::int from clients where status = 'won') as closed_won,
        (select count(*)::int from clients where status = 'lost') as closed_lost,
        (select count(*)::int from clients where owner_id is null and status = any(${OPEN_STATUSES}::text[])) as unassigned,
        (select round(avg(lead_score))::int from clients c where ${inRange} and lead_score is not null) as avg_score,
        (select count(*)::int from meetings where status = 'scheduled' and starts_at between now() and now() + interval '7 days') as meetings_week,
        (select count(*)::int from tasks where completed_at is null and due_at < now()) as overdue_tasks`,

    sql<{ bucket: string; leads: number; won: number }[]>`
      with series as (
        select generate_series(
          date_trunc(${bucket}, ${trendStart}::timestamptz at time zone ${tz}),
          date_trunc(${bucket}, now() at time zone ${tz}),
          ${step}::interval
        ) as b
      )
      select to_char(s.b, 'YYYY-MM-DD') as bucket,
             count(c.id)::int as leads,
             count(c.id) filter (where c.status = 'won')::int as won
      from series s
      left join clients c on date_trunc(${bucket}, c.created_at at time zone ${tz}) = s.b
      group by s.b order by s.b`,

    sql<{ key: string; count: number }[]>`
      select source as key, count(*)::int as count from clients c where ${inRange} group by source order by count desc`,

    sql<{ key: string; count: number; value: number }[]>`
      select status as key, count(*)::int as count, coalesce(sum(deal_value), 0) as value
      from clients group by status`,

    sql<{ key: string; count: number }[]>`
      select s as key, count(*)::int as count
      from clients c, unnest(c.services) s where ${inRange}
      group by s order by count desc`,

    sql<{ key: string | null; count: number; won: number }[]>`
      select utm_campaign as key, count(*)::int as count, count(*) filter (where status = 'won')::int as won
      from clients c where ${inRange} and utm_campaign is not null
      group by utm_campaign order by count desc limit 6`,

    sql<{ id: string; name: string; leads: number; won: number; won_value: number; open_value: number }[]>`
      select u.id, u.name,
             count(c.id) filter (where c.created_at >= ${since})::int as leads,
             count(c.id) filter (where c.status = 'won')::int as won,
             coalesce(sum(c.deal_value) filter (where c.status = 'won'), 0) as won_value,
             coalesce(sum(c.deal_value) filter (where c.status = any(${OPEN_STATUSES}::text[])), 0) as open_value
      from users u left join clients c on c.owner_id = u.id
      where u.is_active
      group by u.id, u.name
      order by won_value desc, leads desc
      limit 8`,

    sql<MeetingRow[]>`
      select m.id, m.title, m.description, m.location, m.meeting_url, m.starts_at, m.ends_at, m.status,
             m.client_id, coalesce(c.company_name, c.contact_name) as client_name, m.owner_id, u.name as owner_name
      from meetings m left join clients c on c.id = m.client_id left join users u on u.id = m.owner_id
      where m.status = 'scheduled' and m.ends_at >= now()
      order by m.starts_at asc limit 5`,

    sql<TaskRow[]>`
      select t.id, t.title, t.due_at, t.priority, t.completed_at, t.client_id,
             coalesce(c.company_name, c.contact_name) as client_name, t.assignee_id, u.name as assignee_name
      from tasks t left join clients c on c.id = t.client_id left join users u on u.id = t.assignee_id
      where t.completed_at is null and (t.assignee_id = ${userId} or t.assignee_id is null)
      order by t.due_at asc nulls last limit 6`,

    sql<{ id: string; company_name: string | null; contact_name: string | null; status: string; source: string; lead_score: number | null; services: string[]; created_at: Date }[]>`
      select id, company_name, contact_name, status, source, lead_score, services, created_at
      from clients order by created_at desc limit 6`,
  ]);

  const closed = kpi.closed_won + kpi.closed_lost;
  return {
    kpi: {
      ...kpi,
      win_rate: closed ? Math.round((kpi.closed_won / closed) * 100) : null,
      lead_change: kpi.prev_leads && days ? Math.round(((kpi.new_leads - kpi.prev_leads) / kpi.prev_leads) * 100) : null,
    },
    bucket,
    trend,
    bySource,
    byStage,
    byService,
    byCampaign,
    team,
    upcoming,
    dueTasks,
    recent,
  };
}
