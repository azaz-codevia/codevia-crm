import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import { can, requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";
import { getClient, getClientRelated, getTeam, type ActivityRow } from "@/lib/queries";
import type { Status } from "@/lib/constants";
import { buttonClass, Badge, Card, CardTitle, LinkButton } from "@/components/ui";
import { cn, formatDate, formatDateTime, formatMoney, relativeTime, whatsappLink } from "@/lib/utils";
import { ContactedButton, DeleteClientButton, MeetingsPanel, NotesPanel, StatusSwitcher, TasksPanel } from "@/components/clients/client-panels";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const client = await getClient((await params).id);
  return { title: client?.company_name ?? client?.contact_name ?? "Client" };
}

function humanKey(k: string) {
  return k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.map(renderValue).join("، ");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${humanKey(k)}: ${renderValue(x)}`).join(" · ");
  if (typeof v === "boolean") return v ? "✓" : "✕";
  return String(v);
}

function activityText(a: ActivityRow, t: Dictionary, team: Map<string, string>) {
  const d = a.data ?? {};
  const status = (s: unknown) => t.status[s as Status] ?? String(s);
  switch (a.type) {
    case "status_changed":
      return fmt(t.activity.status_changed, { from: status(d.from), to: status(d.to) });
    case "assigned":
      return fmt(t.activity.assigned, { owner: team.get(String(d.owner_id)) ?? "—" });
    case "webhook":
      return fmt(t.activity.webhook, { source: t.source[d.source as keyof typeof t.source] ?? String(d.source ?? "API") });
    case "meeting_scheduled":
    case "task_created":
    case "task_completed":
      return fmt(t.activity[a.type], { title: String(d.title ?? "") });
    default:
      return (t.activity as Record<string, string>)[a.type] ?? a.type;
  }
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { t, locale } = await getI18n();
  const client = await getClient(id);
  if (!client) notFound();
  const [{ notes, activities, meetings, tasks }, teamAll] = await Promise.all([getClientRelated(id), getTeam(true)]);
  const team = teamAll.filter((m) => m.is_active).map((m) => ({ id: m.id, name: m.name }));
  const teamNames = new Map(teamAll.map((m) => [m.id, m.name]));
  const tc = t.clients;
  const title = client.company_name ?? client.contact_name ?? "—";
  const wa = whatsappLink(client.phone);
  const discovery = Object.entries(client.discovery ?? {}).filter(([k]) => !["form_name"].includes(k));

  const details: [string, React.ReactNode][] = [
    [tc.contact, client.contact_name],
    [tc.jobTitle, client.job_title],
    [tc.email, client.email && <a href={`mailto:${client.email}`} className="hover:text-lime" dir="ltr">{client.email}</a>],
    [tc.phone, client.phone && <a href={`tel:${client.phone}`} className="num hover:text-lime">{client.phone}</a>],
    [tc.city, client.city],
    [tc.industry, client.industry],
    [tc.companySize, client.company_size],
    [tc.website, client.website && <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className="hover:text-lime" dir="ltr">{client.website}</a>],
    [tc.budget, client.budget_range],
    [tc.timeline, client.timeline],
    [tc.language, client.preferred_language === "ar" ? "العربية" : client.preferred_language === "en" ? "English" : client.preferred_language],
    [tc.priority, <Badge key="p" tone={`tone-${client.priority}`}>{t.priority[client.priority]}</Badge>],
    [tc.score, client.lead_score != null && <span className="num">{client.lead_score} / 100</span>],
    [tc.followUp, client.next_follow_up_at && formatDateTime(client.next_follow_up_at, locale)],
    [tc.lastContacted, client.last_contacted_at && relativeTime(client.last_contacted_at, locale)],
    [tc.lostReason, client.status === "lost" ? client.lost_reason : null],
    [tc.created, formatDate(client.created_at, locale)],
  ];

  return (
    <div>
      <Link prefetch={false} href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t.nav.clients}
      </Link>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{t.source[client.source as keyof typeof t.source] ?? client.source}</span>
            {client.utm_campaign && <Badge>{client.utm_campaign}</Badge>}
            {client.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)}
          </div>
          <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-soft">
            {client.company_name && client.contact_name && <span>{client.contact_name}</span>}
            {client.deal_value != null && <span className="num text-fg">{formatMoney(client.deal_value, locale, client.currency)}</span>}
            <span className="text-muted">{tc.owner}: {client.owner_name ?? t.common.unassigned}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSwitcher clientId={client.id} status={client.status} />
          <LinkButton href={`/clients/${client.id}/edit`} variant="secondary">
            <Pencil className="h-4 w-4" aria-hidden /> {t.common.edit}
          </LinkButton>
          {can(user, "delete") && <DeleteClientButton clientId={client.id} />}
        </div>
      </header>

      {/* Quick contact actions — big targets for phone use */}
      <div className="mb-5 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {client.phone && (
          <a href={`tel:${client.phone}`} className={buttonClass("secondary", "md", "justify-center")}>
            <Phone className="h-4 w-4" aria-hidden /> {tc.call}
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md", "justify-center")}>
            <MessageCircle className="h-4 w-4 text-lime" aria-hidden /> {tc.whatsapp}
          </a>
        )}
        {client.email && (
          <a href={`mailto:${client.email}`} className={buttonClass("secondary", "md", "justify-center")}>
            <Mail className="h-4 w-4" aria-hidden /> {tc.sendEmail}
          </a>
        )}
        {client.website && (
          <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer" className={buttonClass("ghost", "md", "hidden sm:inline-flex")}>
            <Globe className="h-4 w-4" aria-hidden /> {tc.website}
          </a>
        )}
        <div className="col-span-3 sm:ms-auto">
          <ContactedButton clientId={client.id} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>{tc.details}</CardTitle>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 px-5 pb-5 text-sm">
              {details.filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 break-words">{value}</dd>
                </div>
              ))}
            </dl>
            {client.services.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <p className="mb-2 text-xs text-muted">{tc.services}</p>
                <div className="flex flex-wrap gap-1.5">
                  {client.services.map((s) => (
                    <span key={s} className="rounded-full bg-lime/10 px-2.5 py-1 text-xs text-lime">{t.service[s as keyof typeof t.service] ?? s}</span>
                  ))}
                </div>
              </div>
            )}
            {client.requirements && (
              <div className="border-t border-line px-5 py-4">
                <p className="mb-2 text-xs text-muted">{tc.requirements}</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" dir="auto">{client.requirements}</p>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>{tc.discovery}</CardTitle>
            {discovery.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">{tc.noDiscovery}</p>
            ) : (
              <ol className="flex flex-col gap-3 px-5 pb-5">
                {discovery.map(([k, v]) => (
                  <li key={k} className="rounded-2xl bg-raised/60 p-3">
                    <p className="text-xs text-muted" dir="auto">{humanKey(k)}</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap" dir="auto">{renderValue(v)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {(client.utm_source || client.utm_medium || client.utm_campaign) && (
            <Card>
              <CardTitle>{tc.marketing}</CardTitle>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 pb-5 text-sm" dir="ltr">
                {client.utm_source && (<><dt className="text-muted">utm_source</dt><dd>{client.utm_source}</dd></>)}
                {client.utm_medium && (<><dt className="text-muted">utm_medium</dt><dd>{client.utm_medium}</dd></>)}
                {client.utm_campaign && (<><dt className="text-muted">utm_campaign</dt><dd>{client.utm_campaign}</dd></>)}
              </dl>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <NotesPanel clientId={client.id} notes={notes} currentUserId={user.id} canDeleteAny={can(user, "delete")} />
          <TasksPanel clientId={client.id} tasks={tasks} team={team} currentUserId={user.id} />
          <MeetingsPanel client={{ id: client.id, label: title }} meetings={meetings} team={team} currentUserId={user.id} />

          <Card>
            <CardTitle>{tc.activity}</CardTitle>
            <ol className="relative mx-5 mb-5 border-s border-line">
              {activities.map((a) => (
                <li key={a.id} className="relative ps-5 pb-4 last:pb-0">
                  <span className={cn("absolute -start-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-panel", a.type === "webhook" || a.type === "created" || a.type === "imported" ? "bg-lime" : "bg-line-strong")} />
                  <p className="text-sm">
                    {!["webhook", "resubmitted"].includes(a.type) && <span className="font-medium">{a.user_name ?? t.activity.system} </span>}
                    <span className="text-soft">{activityText(a, t, teamNames)}</span>
                  </p>
                  <p className="text-xs text-muted" title={formatDateTime(a.created_at, locale)}>{relativeTime(a.created_at, locale)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

