"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import {
  isPriority,
  isSource,
  isStatus,
  MEETING_STATUSES,
  SERVICES,
  type MeetingStatus,
  type Service,
  type Status,
} from "@/lib/constants";
import { findDuplicate, normalizeLead, upsertLead, type LeadInput } from "@/lib/leads";
import { normalizePhone, str, zonedInputToUtc } from "@/lib/utils";
import type { FormState } from "./auth";

const UUID = /^[0-9a-f-]{36}$/i;
const json = (v: unknown) => v;

function uuidOrNull(v: FormDataEntryValue | null) {
  const s = str(v);
  return s && UUID.test(s) ? s : null;
}

function clientFromForm(fd: FormData) {
  const services = fd.getAll("services").map(String).filter((s): s is Service => (SERVICES as readonly string[]).includes(s));
  const status = str(fd.get("status"));
  const priority = str(fd.get("priority"));
  const source = str(fd.get("source"));
  const dealValue = str(fd.get("deal_value"));
  const score = str(fd.get("lead_score"));
  const followUp = str(fd.get("next_follow_up_at"));
  const email = str(fd.get("email"))?.toLowerCase() ?? null;
  return {
    company_name: str(fd.get("company_name")),
    contact_name: str(fd.get("contact_name")),
    job_title: str(fd.get("job_title")),
    email: email && /^\S+@\S+\.\S+$/.test(email) ? email : null,
    phone: str(fd.get("phone")),
    city: str(fd.get("city")),
    industry: str(fd.get("industry")),
    company_size: str(fd.get("company_size")),
    website: str(fd.get("website")),
    services,
    budget_range: str(fd.get("budget_range")),
    timeline: str(fd.get("timeline")),
    requirements: str(fd.get("requirements")),
    status: isStatus(status) ? status : "new",
    priority: isPriority(priority) ? priority : "medium",
    source: isSource(source) ? source : "manual",
    deal_value: dealValue ? Number(dealValue.replace(/[^\d.]/g, "")) || null : null,
    lead_score: score ? Math.max(0, Math.min(100, Math.round(Number(score)))) || null : null,
    utm_source: str(fd.get("utm_source")),
    utm_medium: str(fd.get("utm_medium")),
    utm_campaign: str(fd.get("utm_campaign")),
    preferred_language: str(fd.get("preferred_language")),
    tags: (str(fd.get("tags")) ?? "").split(/[,،]/).map((s) => s.trim()).filter(Boolean).slice(0, 20),
    lost_reason: str(fd.get("lost_reason")),
    owner_id: uuidOrNull(fd.get("owner_id")),
    next_follow_up_at: followUp ? zonedInputToUtc(followUp) : null,
  };
}

// ── Clients ─────────────────────────────────────────────────────────────

export async function createClient(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const c = clientFromForm(fd);
  if (!c.company_name && !c.contact_name) return { error: "required" };

  const sql = db();
  if (fd.get("ignore_duplicate") !== "1") {
    const dup = await findDuplicate(sql, c);
    if (dup) return { error: "duplicate", duplicateId: dup.id };
  }

  const lead: LeadInput = { ...normalizeLead({}), ...c, discovery: {} };
  // No explicit transactions: they're fragile through Supabase's transaction pooler on serverless.
  const id = await (async (tx) => {
    const res = await upsertLead(tx, lead, {
      userId: user.id,
      source: c.source,
      ownerId: c.owner_id ?? user.id,
      onDuplicate: "insert",
      activityType: "created",
    });
    await tx`update clients set lost_reason = ${c.lost_reason}, next_follow_up_at = ${c.next_follow_up_at},
      won_at = ${c.status === "won" ? new Date() : null} where id = ${res.id}`;
    return res.id;
  })(sql);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  redirect(`/clients/${id}`);
}

export async function updateClient(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!UUID.test(id)) return { error: "notFound" };
  const c = clientFromForm(fd);
  if (!c.company_name && !c.contact_name) return { error: "required" };

  const sql = db();
  await (async (tx) => {
    const [before] = await tx<{ status: Status; owner_id: string | null }[]>`select status, owner_id from clients where id = ${id}`;
    if (!before) return;
    await tx`
      update clients set
        company_name = ${c.company_name}, contact_name = ${c.contact_name}, job_title = ${c.job_title},
        email = ${c.email}, phone = ${c.phone}, phone_normalized = ${normalizePhone(c.phone)},
        city = ${c.city}, industry = ${c.industry}, company_size = ${c.company_size}, website = ${c.website},
        services = ${c.services}::text[], budget_range = ${c.budget_range}, timeline = ${c.timeline},
        requirements = ${c.requirements}, status = ${c.status}, priority = ${c.priority}, source = ${c.source},
        deal_value = ${c.deal_value}, lead_score = ${c.lead_score},
        utm_source = ${c.utm_source}, utm_medium = ${c.utm_medium}, utm_campaign = ${c.utm_campaign},
        preferred_language = ${c.preferred_language}, tags = ${c.tags}::text[], lost_reason = ${c.lost_reason},
        owner_id = ${c.owner_id}, next_follow_up_at = ${c.next_follow_up_at},
        won_at = case when ${c.status} = 'won' and status <> 'won' then now() when ${c.status} <> 'won' then null else won_at end
      where id = ${id}`;
    await tx`insert into activities (client_id, user_id, type) values (${id}, ${user.id}, 'updated')`;
    if (before.status !== c.status) {
      await tx`insert into activities (client_id, user_id, type, data)
        values (${id}, ${user.id}, 'status_changed', ${tx.json(json({ from: before.status, to: c.status }))})`;
    }
    if (before.owner_id !== c.owner_id && c.owner_id) {
      await tx`insert into activities (client_id, user_id, type, data)
        values (${id}, ${user.id}, 'assigned', ${tx.json(json({ owner_id: c.owner_id }))})`;
    }
  })(sql);
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function setClientStatus(ids: string[], status: string) {
  const user = await requireUser();
  if (!isStatus(status)) return { error: "invalid" };
  const valid = ids.filter((i) => UUID.test(i)).slice(0, 500);
  if (!valid.length) return { ok: true };
  const sql = db();
  await (async (tx) => {
    const changed = await tx<{ id: string; from: string }[]>`
      with prev as (select id, status from clients where id = any(${valid}::uuid[]) and status <> ${status})
      update clients c set status = ${status},
        won_at = case when ${status} = 'won' then now() else null end
      from prev where c.id = prev.id
      returning c.id, prev.status as from`;
    for (const row of changed) {
      await tx`insert into activities (client_id, user_id, type, data)
        values (${row.id}, ${user.id}, 'status_changed', ${tx.json(json({ from: row.from, to: status }))})`;
    }
  })(sql);
  revalidatePath("/clients");
  revalidatePath("/pipeline");
  revalidatePath("/dashboard");
  for (const id of valid.slice(0, 20)) revalidatePath(`/clients/${id}`);
  return { ok: true };
}

export async function assignClients(ids: string[], ownerId: string | null) {
  const user = await requireUser();
  const valid = ids.filter((i) => UUID.test(i)).slice(0, 500);
  const owner = ownerId && UUID.test(ownerId) ? ownerId : null;
  const sql = db();
  await (async (tx) => {
    await tx`update clients set owner_id = ${owner} where id = any(${valid}::uuid[])`;
    if (owner) {
      for (const id of valid) {
        await tx`insert into activities (client_id, user_id, type, data) values (${id}, ${user.id}, 'assigned', ${tx.json(json({ owner_id: owner }))})`;
      }
    }
  })(sql);
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markContacted(id: string) {
  const user = await requireUser();
  if (!UUID.test(id)) return;
  const sql = db();
  await sql`update clients set last_contacted_at = now(),
    status = case when status = 'new' then 'contacted' else status end where id = ${id}`;
  await sql`insert into activities (client_id, user_id, type) values (${id}, ${user.id}, 'contacted')`;
  revalidatePath(`/clients/${id}`);
}

export async function deleteClients(ids: string[]) {
  const user = await requireUser();
  if (!can(user, "delete")) return { error: "forbidden" };
  const valid = ids.filter((i) => UUID.test(i));
  await db()`delete from clients where id = any(${valid}::uuid[])`;
  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteClientAndRedirect(id: string) {
  const res = await deleteClients([id]);
  if (res.error) return res;
  redirect("/clients");
}

export async function searchClients(q: string) {
  await requireUser();
  const sql = db();
  const term = q.trim();
  const like = `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  return sql<{ id: string; label: string; sub: string | null }[]>`
    select id, coalesce(company_name, contact_name, email, phone) as label,
           case when company_name is not null then contact_name else email end as sub
    from clients
    ${term ? sql`where company_name ilike ${like} or contact_name ilike ${like} or email ilike ${like} or phone ilike ${like}` : sql``}
    order by updated_at desc limit 12`;
}

// ── Notes ───────────────────────────────────────────────────────────────

export async function addNote(clientId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const body = str(fd.get("body"));
  if (!body || !UUID.test(clientId)) return { error: "required" };
  const sql = db();
  await sql`insert into notes (client_id, author_id, body) values (${clientId}, ${user.id}, ${body.slice(0, 20000)})`;
  await sql`insert into activities (client_id, user_id, type) values (${clientId}, ${user.id}, 'note_added')`;
  await sql`update clients set updated_at = now() where id = ${clientId}`;
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function toggleNotePin(noteId: string, clientId: string) {
  await requireUser();
  await db()`update notes set is_pinned = not is_pinned where id = ${noteId}`;
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteNote(noteId: string, clientId: string) {
  const user = await requireUser();
  const sql = db();
  if (can(user, "delete")) await sql`delete from notes where id = ${noteId}`;
  else await sql`delete from notes where id = ${noteId} and author_id = ${user.id}`;
  revalidatePath(`/clients/${clientId}`);
}

// ── Tasks ───────────────────────────────────────────────────────────────

export async function createTask(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = str(fd.get("title"));
  if (!title) return { error: "required" };
  const clientId = uuidOrNull(fd.get("client_id"));
  const due = str(fd.get("due_at"));
  const priority = str(fd.get("priority"));
  const assignee = uuidOrNull(fd.get("assignee_id")) ?? user.id;
  const sql = db();
  await sql`insert into tasks (client_id, title, due_at, priority, assignee_id, created_by)
    values (${clientId}, ${title.slice(0, 500)}, ${due ? zonedInputToUtc(due) : null},
            ${isPriority(priority) ? priority : "medium"}, ${assignee}, ${user.id})`;
  if (clientId) {
    await sql`insert into activities (client_id, user_id, type, data) values (${clientId}, ${user.id}, 'task_created', ${sql.json(json({ title }))})`;
    revalidatePath(`/clients/${clientId}`);
  }
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleTask(taskId: string) {
  const user = await requireUser();
  if (!UUID.test(taskId)) return;
  const sql = db();
  const [task] = await sql<{ client_id: string | null; title: string; completed_at: Date | null }[]>`
    update tasks set completed_at = case when completed_at is null then now() else null end
    where id = ${taskId} returning client_id, title, completed_at`;
  if (task?.client_id) {
    if (task.completed_at) {
      await sql`insert into activities (client_id, user_id, type, data) values (${task.client_id}, ${user.id}, 'task_completed', ${sql.json(json({ title: task.title }))})`;
    }
    revalidatePath(`/clients/${task.client_id}`);
  }
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function deleteTask(taskId: string) {
  await requireUser();
  if (!UUID.test(taskId)) return;
  const [task] = await db()<{ client_id: string | null }[]>`delete from tasks where id = ${taskId} returning client_id`;
  if (task?.client_id) revalidatePath(`/clients/${task.client_id}`);
  revalidatePath("/tasks");
}

// ── Meetings ────────────────────────────────────────────────────────────

export async function saveMeeting(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = uuidOrNull(fd.get("id"));
  const title = str(fd.get("title"));
  const startsRaw = str(fd.get("starts_at"));
  const endsRaw = str(fd.get("ends_at"));
  if (!title || !startsRaw || !endsRaw) return { error: "required" };
  const starts = zonedInputToUtc(startsRaw);
  const ends = zonedInputToUtc(endsRaw);
  if (!starts || !ends || ends <= starts) return { error: "range" };

  const statusRaw = str(fd.get("status"));
  const status: MeetingStatus = (MEETING_STATUSES as readonly string[]).includes(statusRaw ?? "") ? (statusRaw as MeetingStatus) : "scheduled";
  const clientId = uuidOrNull(fd.get("client_id"));
  const ownerId = uuidOrNull(fd.get("owner_id")) ?? user.id;
  const fields = {
    title: title.slice(0, 300),
    description: str(fd.get("description")),
    location: str(fd.get("location")),
    meeting_url: str(fd.get("meeting_url")),
  };

  const sql = db();
  if (id) {
    await sql`update meetings set
      title = ${fields.title}, description = ${fields.description}, location = ${fields.location},
      meeting_url = ${fields.meeting_url}, starts_at = ${starts}, ends_at = ${ends}, status = ${status},
      client_id = ${clientId}, owner_id = ${ownerId}, sequence = sequence + 1
      where id = ${id}`;
  } else {
    await sql`insert into meetings (title, description, location, meeting_url, starts_at, ends_at, status, client_id, owner_id, created_by)
      values (${fields.title}, ${fields.description}, ${fields.location}, ${fields.meeting_url}, ${starts}, ${ends}, ${status},
              ${clientId}, ${ownerId}, ${user.id})`;
    if (clientId) {
      await sql`insert into activities (client_id, user_id, type, data)
        values (${clientId}, ${user.id}, 'meeting_scheduled', ${sql.json(json({ title: fields.title, starts_at: starts.toISOString() }))})`;
      // A booked meeting moves early-stage leads forward
      await sql`update clients set status = 'meeting' where id = ${clientId} and status in ('new','contacted','qualified')`;
    }
  }
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteMeeting(id: string) {
  await requireUser();
  if (!UUID.test(id)) return;
  const [m] = await db()<{ client_id: string | null }[]>`delete from meetings where id = ${id} returning client_id`;
  if (m?.client_id) revalidatePath(`/clients/${m.client_id}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}
