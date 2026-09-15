import Link from "next/link";
import { can, requireUser } from "@/lib/auth";
import { calendarFeedUrls, getAppUrl } from "@/lib/app-url";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { FIELD_ALIASES } from "@/lib/leads";
import { getTeam } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { SubscribePanel } from "@/components/calendar/subscribe-panel";
import { ProfilePanel } from "@/components/settings/profile-panel";
import { IntegrationsPanel, type ApiKeyRow, type WebhookLogRow } from "@/components/settings/integrations-panel";
import { TeamPanel } from "@/components/settings/team-panel";

export const metadata = { title: "Settings" };

const TABS = ["profile", "calendar", "integrations", "team"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const ts = t.settings;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? "") ? (rawTab as Tab) : "profile";
  const base = await getAppUrl();

  const labels: Record<Tab, string> = { profile: ts.profile, calendar: ts.calendarFeed, integrations: ts.integrations, team: ts.team };
  const sql = db();

  let body: React.ReactNode = null;
  if (tab === "profile") {
    body = <ProfilePanel name={user.name} email={user.email} role={user.role} />;
  } else if (tab === "calendar") {
    body = (
      <Card className="max-w-xl">
        <CardTitle>{t.calendar.subscribeTitle}</CardTitle>
        <div className="px-5 pb-5">
          <SubscribePanel feeds={calendarFeedUrls(base, user.calendar_token)} />
        </div>
      </Card>
    );
  } else if (tab === "integrations") {
    const [keys, logs] = await Promise.all([
      sql<ApiKeyRow[]>`select id, name, key_prefix, default_source, last_used_at, revoked_at, created_at from api_keys order by revoked_at nulls first, created_at desc`,
      sql<WebhookLogRow[]>`
        select l.id, l.outcome, l.client_id, coalesce(c.company_name, c.contact_name, c.email) as client_name, l.error, k.name as key_name, l.created_at
        from webhook_logs l left join clients c on c.id = l.client_id left join api_keys k on k.id = l.api_key_id
        order by l.created_at desc limit 40`,
    ]);
    const fieldNames = Object.entries(FIELD_ALIASES).map(([field, aliases]) => ({ field, aliases: aliases.filter((a) => a !== field).slice(0, 6).join(" · ") }));
    body = <IntegrationsPanel endpoint={`${base}/api/webhooks/leads`} keys={keys} logs={logs} canManage={can(user, "manageKeys")} fieldNames={fieldNames} />;
  } else {
    body = can(user, "manageTeam") ? (
      <TeamPanel members={await getTeam(true)} currentUserId={user.id} />
    ) : (
      <Card><p className="px-6 py-10 text-center text-sm text-muted">{ts.adminOnly}</p></Card>
    );
  }

  return (
    <div>
      <PageHeader title={ts.title} />
      <nav className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label={ts.title}>
        <div className="inline-flex gap-1 rounded-full bg-panel p-1 ring-1 ring-inset ring-line">
          {TABS.map((k) => (
            <Link
              key={k}
              href={k === "profile" ? "/settings" : `/settings?tab=${k}`}
              aria-current={tab === k ? "page" : undefined}
              className={cn("rounded-full px-4 py-2 text-sm whitespace-nowrap transition-colors", tab === k ? "bg-lime font-medium text-black" : "text-muted hover:text-fg")}
            >
              {labels[k]}
            </Link>
          ))}
        </div>
      </nav>
      {body}
    </div>
  );
}
