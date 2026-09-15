"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import { PRIORITIES, SERVICES, SOURCES, STATUSES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { ClientFilters } from "@/lib/queries";
import { Button, Input, Select } from "@/components/ui";

export function ClientFiltersBar({
  filters,
  team,
  campaigns,
}: {
  filters: ClientFilters;
  team: { id: string; name: string }[];
  campaigns: string[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  const update = (patch: Partial<ClientFilters>) => {
    const next = { ...filters, ...patch, page: undefined };
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]);
    start(() => router.push(`${pathname}?${params}`));
  };
  const active = Boolean(filters.q || filters.status || filters.source || filters.owner || filters.service || filters.priority || filters.campaign);

  return (
    <div className="flex flex-col gap-2" aria-busy={pending}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: String(new FormData(e.currentTarget).get("q") ?? "") });
        }}
      >
        <Input key={filters.q} name="q" type="search" defaultValue={filters.q} placeholder={t.clients.searchPlaceholder} className="rounded-full ps-4" />
        <Button type="submit" variant="secondary">{t.common.filter}</Button>
      </form>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Select aria-label={t.clients.status} value={filters.status ?? ""} onChange={(e) => update({ status: e.target.value })} className="w-auto min-w-36 rounded-full">
          <option value="">{t.clients.status}: {t.common.all}</option>
          <option value="open">{t.dashboard.pipelineValue}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
        </Select>
        <Select aria-label={t.clients.source} value={filters.source ?? ""} onChange={(e) => update({ source: e.target.value })} className="w-auto min-w-36 rounded-full">
          <option value="">{t.clients.source}: {t.common.all}</option>
          {SOURCES.map((s) => <option key={s} value={s}>{t.source[s]}</option>)}
        </Select>
        <Select aria-label={t.clients.services} value={filters.service ?? ""} onChange={(e) => update({ service: e.target.value })} className="w-auto min-w-40 rounded-full">
          <option value="">{t.clients.services}: {t.common.all}</option>
          {SERVICES.map((s) => <option key={s} value={s}>{t.service[s]}</option>)}
        </Select>
        <Select aria-label={t.clients.owner} value={filters.owner ?? ""} onChange={(e) => update({ owner: e.target.value })} className="w-auto min-w-36 rounded-full">
          <option value="">{t.clients.owner}: {t.common.all}</option>
          <option value="none">{t.common.unassigned}</option>
          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        <Select aria-label={t.clients.priority} value={filters.priority ?? ""} onChange={(e) => update({ priority: e.target.value })} className="w-auto min-w-32 rounded-full">
          <option value="">{t.clients.priority}: {t.common.all}</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{t.priority[p]}</option>)}
        </Select>
        {campaigns.length > 0 && (
          <Select aria-label={t.clients.campaign} value={filters.campaign ?? ""} onChange={(e) => update({ campaign: e.target.value })} className="w-auto min-w-36 rounded-full">
            <option value="">{t.clients.campaign}: {t.common.all}</option>
            {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        )}
        <Select aria-label="Sort" value={filters.sort ?? "newest"} onChange={(e) => update({ sort: e.target.value })} className="w-auto min-w-36 rounded-full">
          <option value="newest">↓ {t.clients.created}</option>
          <option value="oldest">↑ {t.clients.created}</option>
          <option value="score">↓ {t.clients.score}</option>
          <option value="value">↓ {t.clients.dealValue}</option>
          <option value="followup">↑ {t.clients.followUp}</option>
          <option value="name">A–Z</option>
        </Select>
        {active && (
          <Button type="button" variant="ghost" onClick={() => start(() => router.push(pathname))}>
            <X className="h-4 w-4" aria-hidden /> {t.common.clear}
          </Button>
        )}
      </div>
    </div>
  );
}
