import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requireUser, can } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { getTeam, listCampaigns, listClients, type ClientFilters } from "@/lib/queries";
import { Card, EmptyState, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { ClientFiltersBar } from "@/components/clients/filters";
import { ClientsTable } from "@/components/clients/clients-table";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<ClientFilters> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const filters = await searchParams;
  const [{ rows, total, page, pages }, team, campaigns] = await Promise.all([listClients(filters), getTeam(), listCampaigns()]);
  const hasFilters = Boolean(filters.q || filters.status || filters.source || filters.owner || filters.service || filters.priority || filters.campaign);

  const qs = (p: number) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
    params.set("page", String(p));
    return `/clients?${params}`;
  };
  const exportParams = new URLSearchParams(Object.entries(filters).filter(([k, v]) => v && k !== "page") as [string, string][]);

  return (
    <div>
      <PageHeader
        title={t.clients.title}
        subtitle={fmt(t.common.results, { count: total })}
        actions={
          <>
            <a href={`/api/export/clients?${exportParams}`} className={buttonClass("secondary", "md")}>
              <Download className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t.common.export}</span>
            </a>
            <LinkButton href="/clients/new">
              <Plus className="h-4 w-4" aria-hidden />
              {t.clients.new}
            </LinkButton>
          </>
        }
      />

      <ClientFiltersBar filters={filters} team={team.map((m) => ({ id: m.id, name: m.name }))} campaigns={campaigns} />

      <Card className="mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            action={
              !hasFilters && (
                <div className="flex flex-wrap justify-center gap-2">
                  <LinkButton href="/clients/new" size="sm">{t.clients.new}</LinkButton>
                  <LinkButton href="/import" size="sm" variant="secondary">{t.nav.import}</LinkButton>
                  <LinkButton href="/settings?tab=integrations" size="sm" variant="secondary">{t.settings.integrations}</LinkButton>
                </div>
              )
            }
          >
            {hasFilters ? t.clients.empty : t.clients.emptyAll}
          </EmptyState>
        ) : (
          <ClientsTable rows={rows} team={team.map((m) => ({ id: m.id, name: m.name }))} canDelete={can(user, "delete")} />
        )}
      </Card>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{fmt(t.common.page, { page, total: pages })}</span>
          <div className="flex gap-2">
            {page > 1 && <Link prefetch={false} className={buttonClass("secondary", "sm")} href={qs(page - 1)}>{t.common.previous}</Link>}
            {page < pages && <Link prefetch={false} className={buttonClass("secondary", "sm")} href={qs(page + 1)}>{t.common.next}</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
