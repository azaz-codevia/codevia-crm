import type { Sql } from "./db";
import { isPriority, isSource, isStatus, SERVICES, type Service, type Source, type Status } from "./constants";
import { normalizePhone } from "./utils";

export type LeadInput = {
  company_name: string | null;
  contact_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  services: Service[];
  budget_range: string | null;
  timeline: string | null;
  requirements: string | null;
  lead_score: number | null;
  deal_value: number | null;
  status: Status | null;
  priority: "low" | "medium" | "high" | null;
  source: Source | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  preferred_language: string | null;
  tags: string[];
  discovery: Record<string, unknown>;
};

/** Every field we recognise, with the loose aliases people and tools use (EN + AR). */
export const FIELD_ALIASES: Record<keyof Omit<LeadInput, "discovery">, string[]> = {
  company_name: ["company", "company_name", "companyname", "business", "business_name", "organization", "organisation", "brand", "store", "اسم الشركة", "الشركة", "اسم النشاط", "النشاط", "المنشأة", "اسم المنشأة"],
  contact_name: ["name", "full_name", "fullname", "contact", "contact_name", "client_name", "customer_name", "first_name", "الاسم", "الاسم الكامل", "اسم العميل", "اسم المسؤول"],
  job_title: ["title", "job_title", "position", "role", "designation", "المسمى", "المسمى الوظيفي", "المنصب"],
  email: ["email", "email_address", "e-mail", "mail", "البريد", "البريد الإلكتروني", "الايميل", "الإيميل"],
  phone: ["phone", "phone_number", "mobile", "mobile_number", "whatsapp", "whatsapp_number", "tel", "telephone", "contact_number", "الجوال", "رقم الجوال", "الهاتف", "رقم الهاتف", "واتساب", "رقم الواتساب"],
  city: ["city", "location", "region", "المدينة", "المنطقة", "الموقع"],
  industry: ["industry", "sector", "business_type", "vertical", "القطاع", "المجال", "نوع النشاط"],
  company_size: ["company_size", "size", "employees", "team_size", "number_of_employees", "حجم الشركة", "عدد الموظفين"],
  website: ["website", "website_url", "url", "site", "الموقع الإلكتروني", "رابط الموقع"],
  services: ["services", "service", "service_type", "interested_in", "needs", "solution", "solutions", "الخدمات", "الخدمة", "الخدمة المطلوبة", "الحل المطلوب"],
  budget_range: ["budget", "budget_range", "الميزانية", "الميزانية المتوقعة"],
  timeline: ["timeline", "timeframe", "when", "start_date", "urgency", "الإطار الزمني", "المدة", "موعد البدء"],
  requirements: ["requirements", "message", "details", "project_details", "description", "notes", "comments", "pain_points", "challenge", "المتطلبات", "التفاصيل", "الرسالة", "تفاصيل المشروع", "الوصف", "ملاحظات"],
  lead_score: ["lead_score", "score", "leadscore", "التقييم", "درجة العميل"],
  deal_value: ["deal_value", "value", "amount", "deal_amount", "قيمة الصفقة", "القيمة"],
  status: ["status", "stage", "lead_status", "الحالة", "المرحلة"],
  priority: ["priority", "الأولوية"],
  source: ["source", "lead_source", "channel", "المصدر"],
  utm_source: ["utm_source"],
  utm_medium: ["utm_medium"],
  utm_campaign: ["utm_campaign", "campaign", "campaign_name", "الحملة"],
  preferred_language: ["language", "lang", "locale", "preferred_language", "اللغة"],
  tags: ["tags", "labels", "الوسوم"],
};

export function keyOf(label: string) {
  return label
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, "_")
    .replace(/[^\p{L}\p{N}_]/gu, "");
}

const ALIAS_LOOKUP: Map<string, keyof typeof FIELD_ALIASES> = (() => {
  const m = new Map<string, keyof typeof FIELD_ALIASES>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) m.set(keyOf(a), field as keyof typeof FIELD_ALIASES);
  }
  return m;
})();

export function matchField(header: string): keyof typeof FIELD_ALIASES | null {
  return ALIAS_LOOKUP.get(keyOf(header)) ?? null;
}

const SERVICE_KEYWORDS: Array<[Service, RegExp]> = [
  ["erp", /erp|inventory|accounting|operations|hr\b|payroll|مخزون|محاسب|تخطيط موارد|موارد|عمليات|رواتب/i],
  ["government", /gov|compliance|regulat|licens|حكوم|امتثال|ترخيص|تراخيص/i],
  ["mobile_app", /mobile|ios|android|app\b|تطبيق|جوال/i],
  ["ecommerce", /e-?commerce|shop|store|متجر|تجارة/i],
  ["ai_automation", /\bai\b|artificial|automation|chatbot|nlp|ذكاء|أتمتة|اتمتة|روبوت/i],
  ["integration", /integrat|api|connect|whatsapp business|ربط|تكامل/i],
  ["support", /support|maintenance|دعم|صيانة/i],
  ["web_app", /web|portal|platform|website|dashboard|crm|موقع|منصة|بوابة|نظام/i],
];

export function parseServices(value: unknown): Service[] {
  const items = Array.isArray(value) ? value.map(String) : value == null ? [] : String(value).split(/[,،;|\n]+/);
  const out = new Set<Service>();
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    const exact = keyOf(item);
    if ((SERVICES as readonly string[]).includes(exact)) {
      out.add(exact as Service);
      continue;
    }
    const hit = SERVICE_KEYWORDS.find(([, re]) => re.test(item));
    out.add(hit ? hit[0] : "other");
  }
  return [...out];
}

function text(v: unknown, max = 5000): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) v = v.join(", ");
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Unwraps common webhook envelopes (Webflow, Zapier, Make, generic { data }) */
export function unwrapPayload(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, unknown>;
  const payload = b.payload as Record<string, unknown> | undefined;
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return { ...(payload.data as Record<string, unknown>), form_name: payload.name ?? undefined };
  }
  if (b.data && typeof b.data === "object" && !Array.isArray(b.data)) {
    return { ...b, ...(b.data as Record<string, unknown>), data: undefined };
  }
  return b;
}

/**
 * Turns any flat object (webhook body or mapped spreadsheet row) into a LeadInput.
 * Unknown keys are kept in `discovery`, so no answer from the discovery form is ever lost.
 */
export function normalizeLead(raw: Record<string, unknown>): LeadInput {
  const picked: Partial<Record<keyof typeof FIELD_ALIASES, unknown>> = {};
  const extras: Record<string, unknown> = {};

  // Nested answers object from the discovery site
  const nested = (raw.answers ?? raw.discovery) as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [k, v] of Object.entries(nested)) extras[k] = v;
  }
  // Nested utm object
  const utm = raw.utm as Record<string, unknown> | undefined;
  if (utm && typeof utm === "object") {
    for (const [k, v] of Object.entries(utm)) raw[k.startsWith("utm_") ? k : `utm_${k}`] = v;
  }

  for (const [k, v] of Object.entries(raw)) {
    if (k === "answers" || k === "discovery" || k === "utm" || v === undefined) continue;
    const field = matchField(k);
    if (field && picked[field] == null) picked[field] = v;
    else if (v !== null && v !== "") extras[k] = v;
  }

  const email = text(picked.email, 320)?.toLowerCase() ?? null;
  const status = text(picked.status);
  const priority = text(picked.priority)?.toLowerCase();
  const source = text(picked.source);
  const tags = picked.tags == null ? [] : (Array.isArray(picked.tags) ? picked.tags : String(picked.tags).split(/[,،]/)).map((s) => String(s).trim()).filter(Boolean);
  const score = num(picked.lead_score);

  return {
    company_name: text(picked.company_name, 300),
    contact_name: text(picked.contact_name, 300),
    job_title: text(picked.job_title, 200),
    email: email && /^\S+@\S+\.\S+$/.test(email) ? email : null,
    phone: text(picked.phone, 50),
    city: text(picked.city, 120),
    industry: text(picked.industry, 200),
    company_size: text(picked.company_size, 100),
    website: text(picked.website, 500),
    services: parseServices(picked.services),
    budget_range: text(picked.budget_range, 200),
    timeline: text(picked.timeline, 200),
    requirements: text(picked.requirements, 10000),
    lead_score: score == null ? null : Math.round(Math.max(0, Math.min(100, score))),
    deal_value: num(picked.deal_value),
    status: isStatus(status) ? status : null,
    priority: isPriority(priority) ? priority : null,
    source: isSource(source) ? source : null,
    utm_source: text(picked.utm_source, 200),
    utm_medium: text(picked.utm_medium, 200),
    utm_campaign: text(picked.utm_campaign, 200),
    preferred_language: text(picked.preferred_language, 20),
    tags: tags.slice(0, 20),
    discovery: extras,
  };
}

export function hasIdentity(l: LeadInput) {
  return Boolean(l.company_name || l.contact_name || l.email || l.phone);
}

type Tx = Sql;

export async function findDuplicate(sql: Tx, lead: Pick<LeadInput, "email" | "phone">) {
  const phone = normalizePhone(lead.phone);
  if (!lead.email && !phone) return null;
  const [row] = await sql<{ id: string; company_name: string | null; contact_name: string | null }[]>`
    select id, company_name, contact_name from clients
    where (${lead.email}::text is not null and lower(email) = ${lead.email})
       or (${phone}::text is not null and phone_normalized = ${phone})
    order by created_at asc
    limit 1`;
  return row ?? null;
}

export type UpsertOptions = {
  userId: string | null;
  source: Source;
  defaultStatus?: Status;
  ownerId?: string | null;
  /** skip: leave existing untouched · fill: only fill blanks · refresh: newer values win · insert: always create */
  onDuplicate: "skip" | "fill" | "refresh" | "insert";
  activityType: "created" | "imported" | "webhook";
  activityData?: Record<string, unknown>;
};

export async function upsertLead(sql: Tx, lead: LeadInput, opts: UpsertOptions) {
  const existing = opts.onDuplicate === "insert" ? null : await findDuplicate(sql, lead);
  const phoneNorm = normalizePhone(lead.phone);

  if (existing) {
    if (opts.onDuplicate === "skip") return { outcome: "skipped" as const, id: existing.id };
    const fresh = opts.onDuplicate === "refresh";
    // `pick(a, b)` → newer-wins or fill-blanks, depending on mode
    await sql`
      update clients set
        company_name     = ${fresh ? sql`coalesce(${lead.company_name}, company_name)` : sql`coalesce(company_name, ${lead.company_name})`},
        contact_name     = ${fresh ? sql`coalesce(${lead.contact_name}, contact_name)` : sql`coalesce(contact_name, ${lead.contact_name})`},
        job_title        = coalesce(job_title, ${lead.job_title}),
        email            = coalesce(email, ${lead.email}),
        phone            = coalesce(phone, ${lead.phone}),
        phone_normalized = coalesce(phone_normalized, ${phoneNorm}),
        city             = ${fresh ? sql`coalesce(${lead.city}, city)` : sql`coalesce(city, ${lead.city})`},
        industry         = ${fresh ? sql`coalesce(${lead.industry}, industry)` : sql`coalesce(industry, ${lead.industry})`},
        company_size     = ${fresh ? sql`coalesce(${lead.company_size}, company_size)` : sql`coalesce(company_size, ${lead.company_size})`},
        website          = coalesce(website, ${lead.website}),
        services         = (select array(select distinct unnest(services || ${lead.services}::text[]))),
        budget_range     = ${fresh ? sql`coalesce(${lead.budget_range}, budget_range)` : sql`coalesce(budget_range, ${lead.budget_range})`},
        timeline         = ${fresh ? sql`coalesce(${lead.timeline}, timeline)` : sql`coalesce(timeline, ${lead.timeline})`},
        requirements     = ${fresh ? sql`coalesce(${lead.requirements}, requirements)` : sql`coalesce(requirements, ${lead.requirements})`},
        lead_score       = ${fresh ? sql`coalesce(${lead.lead_score}, lead_score)` : sql`coalesce(lead_score, ${lead.lead_score})`},
        deal_value       = coalesce(deal_value, ${lead.deal_value}),
        utm_source       = coalesce(utm_source, ${lead.utm_source}),
        utm_medium       = coalesce(utm_medium, ${lead.utm_medium}),
        utm_campaign     = coalesce(utm_campaign, ${lead.utm_campaign}),
        preferred_language = coalesce(preferred_language, ${lead.preferred_language}),
        tags             = (select array(select distinct unnest(tags || ${lead.tags}::text[]))),
        discovery        = ${fresh ? sql`discovery || ${sql.json(lead.discovery)}` : sql`${sql.json(lead.discovery)} || discovery`}
      where id = ${existing.id}`;
    if (opts.activityType === "webhook") {
      await sql`insert into activities (client_id, user_id, type, data)
        values (${existing.id}, null, 'resubmitted', ${sql.json({ source: opts.source, ...(opts.activityData ?? {}) })})`;
    }
    return { outcome: "updated" as const, id: existing.id };
  }

  const [row] = await sql<{ id: string }[]>`
    insert into clients (
      company_name, contact_name, job_title, email, phone, phone_normalized, city, industry, company_size, website,
      services, budget_range, timeline, requirements, status, priority, lead_score, deal_value, source,
      utm_source, utm_medium, utm_campaign, preferred_language, tags, discovery, owner_id, created_by
    ) values (
      ${lead.company_name}, ${lead.contact_name}, ${lead.job_title}, ${lead.email}, ${lead.phone}, ${phoneNorm},
      ${lead.city}, ${lead.industry}, ${lead.company_size}, ${lead.website},
      ${lead.services}::text[], ${lead.budget_range}, ${lead.timeline}, ${lead.requirements},
      ${lead.status ?? opts.defaultStatus ?? "new"}, ${lead.priority ?? "medium"}, ${lead.lead_score}, ${lead.deal_value},
      ${lead.source ?? opts.source}, ${lead.utm_source}, ${lead.utm_medium}, ${lead.utm_campaign}, ${lead.preferred_language},
      ${lead.tags}::text[], ${sql.json(lead.discovery)}, ${opts.ownerId ?? null}, ${opts.userId}
    ) returning id`;

  await sql`insert into activities (client_id, user_id, type, data)
    values (${row.id}, ${opts.userId}, ${opts.activityType}, ${sql.json({ source: lead.source ?? opts.source, ...(opts.activityData ?? {}) })})`;

  return { outcome: "created" as const, id: row.id };
}
