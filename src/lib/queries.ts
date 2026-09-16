import { db, type Fragment, type Sql } from "./db";
import { isPriority, isSource, isStatus, OPEN_STATUSES, PAGE_SIZE, SERVICES, type Status } from "./constants";
import { clampInt } from "./utils";

export type TeamMember = { id: string; name: string; email: string; role: string; is_active: boolean; last_login_at: Date | null };

export async function getTeam(includeInactive = false) {
  const sql = db();
  return sql<TeamMember[]>`
    select id, name, email, role, is_active, last_login_at from users
    ${includeInactive ? sql`` : sql`where is_active = true`}
    order by name`;
}

// ── Clients ─────────────────────────────────────────────────────────────

export type ClientRow = {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  services: string[];
  status: Status;
  priority: "low" | "medium" | "high";
  lead_score: number | null;
  deal_value: number | null;
  source: string;
  utm_campaign: string | null;
  owner_id: string | null;
  owner_name: string | null;
  next_follow_up_at: Date | null;
  created_at: Date;
};

export type ClientFilters = {
  q?: string;
  status?: string;
  source?: string;
  owner?: string;
  service?: string;
  priority?: string;
  campaign?: string;
  sort?: string;
  page?: string;
};

export const SORTS: Record<string, string> = {
  newest: "c.created_at desc",
  oldest: "c.created_at asc",
  score: "c.lead_score desc nulls last, c.created_at desc",
  value: "c.deal_value desc nulls last, c.created_at desc",
  followup: "c.next_follow_up_at asc nulls last",
  name: "coalesce(c.company_name, c.contact_name) asc",
};

export function clientWhere(sql: Sql, f: ClientFilters) {
  const parts: Fragment[] = [];
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const digits = q.replace(/\D/g, "");
    parts.push(sql`(
      c.company_name ilike ${like} or c.contact_name ilike ${like} or c.email ilike ${like}
      or c.phone ilike ${like} ${digits.length >= 4 ? sql`or c.phone_normalized like ${"%" + digits + "%"}` : sql``}
    )`);
  }
  if (isStatus(f.status)) parts.push(sql`c.status = ${f.status}`);
  if (f.status === "open") parts.push(sql`c.status = any(${OPEN_STATUSES}::text[])`);
  if (isSource(f.source)) parts.push(sql`c.source = ${f.source}`);
  if (isPriority(f.priority)) parts.push(sql`c.priority = ${f.priority}`);
  if (f.service && (SERVICES as readonly string[]).includes(f.service)) parts.push(sql`${f.service} = any(c.services)`);
  if (f.owner === "none") parts.push(sql`c.owner_id is null`);
  else if (f.owner && /^[0-9a-f-]{36}$/i.test(f.owner)) parts.push(sql`c.owner_id = ${f.owner}`);
  if (f.campaign) parts.push(sql`c.utm_campaign = ${f.campaign}`);

  if (parts.length === 0) return sql`true`;
  return parts.reduce((acc, p, i) => (i === 0 ? p : sql`${acc} and ${p}`));
}

export async function listClients(f: ClientFilters, opts: { all?: boolean } = {}) {
  const sql = db();
  const where = clientWhere(sql, f);
  const page = clampInt(f.page, 1, 10_000, 1);
  const order = SORTS[f.sort ?? "newest"] ?? SORTS.newest;
  const limit = opts.all ? 50_000 : PAGE_SIZE;

  const [rows, [{ total }]] = await Promise.all([
    sql<ClientRow[]>`
      select c.id, c.company_name, c.contact_name, c.email, c.phone, c.city, c.services, c.status, c.priority,
             c.lead_score, c.deal_value, c.source, c.utm_campaign, c.owner_id, u.name as owner_name,
             c.next_follow_up_at, c.created_at
      from clients c left join users u on u.id = c.owner_id
      where ${where}
      order by ${sql.unsafe(order)}
      limit ${limit} offset ${opts.all ? 0 : (page - 1) * PAGE_SIZE}`,
    sql<{ total: number }[]>`select count(*)::int as total from clients c where ${where}`,
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listCampaigns() {
  const sql = db();
  const rows = await sql<{ utm_campaign: string }[]>`
    select distinct utm_campaign from clients where utm_campaign is not null order by utm_campaign limit 200`;
  return rows.map((r) => r.utm_campaign);
}

export type ClientDetail = ClientRow & {
  job_title: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  budget_range: string | null;
  timeline: string | null;
  requirements: string | null;
  currency: string;
  utm_source: string | null;
  utm_medium: string | null;
  preferred_language: string | null;
  tags: string[];
  lost_reason: string | null;
  discovery: Record<string, unknown>;
  last_contacted_at: Date | null;
  won_at: Date | null;
  updated_at: Date;
};

export async function getClient(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = db();
  const [client] = await sql<ClientDetail[]>`
    select c.*, u.name as owner_name from clients c left join users u on u.id = c.owner_id where c.id = ${id}`;
  return client ?? null;
}

export type NoteRow = { id: string; body: string; is_pinned: boolean; created_at: Date; author_id: string | null; author_name: string | null };
export type ActivityRow = { id: string; type: string; data: Record<string, unknown>; created_at: Date; user_name: string | null };
export type MeetingRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  meeting_url: string | null;
  starts_at: Date;
  ends_at: Date;
  status: "scheduled" | "completed" | "cancelled";
  client_id: string | null;
  client_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
};
export type TaskRow = {
  id: string;
  title: string;
  due_at: Date | null;
  priority: "low" | "medium" | "high";
  completed_at: Date | null;
  client_id: string | null;
  client_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
};

export async function getClientRelated(id: string) {
  const sql = db();
  const [notes, activities, meetings, tasks] = await Promise.all([
    sql<NoteRow[]>`
      select n.id, n.body, n.is_pinned, n.created_at, n.author_id, u.name as author_name
      from notes n left join users u on u.id = n.author_id
      where n.client_id = ${id} order by n.is_pinned desc, n.created_at desc`,
    sql<ActivityRow[]>`
      select a.id, a.type, a.data, a.created_at, u.name as user_name
      from activities a left join users u on u.id = a.user_id
      where a.client_id = ${id} order by a.created_at desc limit 50`,
    meetingSelect(sql, sql`m.client_id = ${id}`, sql`m.starts_at desc`),
    taskSelect(sql, sql`t.client_id = ${id}`, sql`t.completed_at is not null, t.due_at asc nulls last`),
  ]);
  return { notes, activities, meetings, tasks };
}

// ── Meetings & tasks ────────────────────────────────────────────────────

function meetingSelect(sql: Sql, where: Fragment, order: Fragment) {
  return sql<MeetingRow[]>`
    select m.id, m.title, m.description, m.location, m.meeting_url, m.starts_at, m.ends_at, m.status,
           m.client_id, coalesce(c.company_name, c.contact_name) as client_name,
           m.owner_id, u.name as owner_name
    from meetings m
    left join clients c on c.id = m.client_id
    left join users u on u.id = m.owner_id
    where ${where}
    order by ${order}`;
}

function taskSelect(sql: Sql, where: Fragment, order: Fragment) {
  return sql<TaskRow[]>`
    select t.id, t.title, t.due_at, t.priority, t.completed_at, t.client_id,
           coalesce(c.company_name, c.contact_name) as client_name, t.assignee_id, u.name as assignee_name
    from tasks t
    left join clients c on c.id = t.client_id
    left join users u on u.id = t.assignee_id
    where ${where}
    order by ${order}`;
}

export async function getMeetingsBetween(from: Date, to: Date, ownerId?: string) {
  const sql = db();
  return meetingSelect(
    sql,
    sql`m.starts_at < ${to} and m.ends_at > ${from} ${ownerId ? sql`and m.owner_id = ${ownerId}` : sql``}`,
    sql`m.starts_at asc`,
  );
}

export async function getTasks(opts: { assigneeId?: string; includeDone?: boolean }) {
  const sql = db();
  const where = sql`${opts.includeDone ? sql`true` : sql`t.completed_at is null`}
    ${opts.assigneeId ? sql`and t.assignee_id = ${opts.assigneeId}` : sql``}`;
  return taskSelect(sql, where, sql`t.completed_at is not null, t.due_at asc nulls last, t.created_at desc`);
}
