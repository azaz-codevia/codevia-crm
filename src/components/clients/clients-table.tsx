"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageCircle, Phone, Trash2 } from "lucide-react";
import { STATUS_TONE, STATUSES } from "@/lib/constants";
import { assignClients, deleteClients, setClientStatus } from "@/lib/actions/crm";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/dictionaries";
import type { ClientRow } from "@/lib/queries";
import { cn, formatDate, formatMoney, whatsappLink } from "@/lib/utils";
import { Avatar, Badge, Button, Select } from "@/components/ui";

export function ClientsTable({ rows, team, canDelete }: { rows: ClientRow[]; team: { id: string; name: string }[]; canDelete: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkOwner, setBulkOwner] = useState("");
  const [pending, start] = useTransition();

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      setSelected(new Set());
      setBulkOwner("");
      setBulkStatus("");
      router.refresh();
    });

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-raised px-4 py-2.5">
          <span className="text-sm font-medium">{fmt(t.clients.selected, { count: selected.size })}</span>
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="h-8 w-auto min-w-32 text-[13px]">
              <option value="">{t.clients.bulkStatus}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
            </Select>
            <Button size="sm" variant="secondary" disabled={!bulkStatus || pending} onClick={() => run(() => setClientStatus([...selected], bulkStatus))}>
              {t.clients.apply}
            </Button>
            <Select value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)} className="h-8 w-auto min-w-32 text-[13px]">
              <option value="">{t.clients.bulkOwner}</option>
              <option value="none">{t.common.unassigned}</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            <Button size="sm" variant="secondary" disabled={!bulkOwner || pending} onClick={() => run(() => assignClients([...selected], bulkOwner === "none" ? null : bulkOwner))}>
              {t.clients.apply}
            </Button>
            {canDelete && (
              <Button
                size="icon"
                variant="danger"
                aria-label={t.common.delete}
                disabled={pending}
                onClick={() => confirm(t.common.confirmDelete) && run(() => deleteClients([...selected]))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className={cn("w-full text-sm", pending && "opacity-60")}>
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="accent-lime"
                />
              </th>
              <th className="px-3 py-3 text-start font-normal">{t.clients.company}</th>
              <th className="px-3 py-3 text-start font-normal">{t.clients.status}</th>
              <th className="hidden px-3 py-3 text-start font-normal xl:table-cell">{t.clients.services}</th>
              <th className="px-3 py-3 text-start font-normal">{t.clients.source}</th>
              <th className="px-3 py-3 text-end font-normal">{t.clients.score}</th>
              <th className="px-3 py-3 text-end font-normal">{t.dashboard.value}</th>
              <th className="px-3 py-3 text-start font-normal">{t.clients.owner}</th>
              <th className="px-3 py-3 text-start font-normal">{t.clients.created}</th>
              <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const wa = whatsappLink(c.phone);
              return (
                <tr key={c.id} className={cn("border-b border-line/70 last:border-0 hover:bg-raised/50", selected.has(c.id) && "bg-raised/70")}>
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label="Select" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="accent-lime" />
                  </td>
                  <td className="max-w-64 px-3 py-3">
                    <Link prefetch={false} href={`/clients/${c.id}`} className="block hover:text-lime">
                      <span className="block truncate font-medium">{c.company_name ?? c.contact_name ?? "—"}</span>
                      <span className="block truncate text-xs text-muted">
                        {c.company_name ? c.contact_name : c.email}
                        {c.city && ` · ${c.city}`}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3"><Badge tone={STATUS_TONE[c.status]}>{t.status[c.status]}</Badge></td>
                  <td className="hidden max-w-52 px-3 py-3 xl:table-cell">
                    <span className="block truncate text-xs text-soft">{c.services.map((s) => t.service[s as keyof typeof t.service] ?? s).join("، ")}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-soft">
                    {t.source[c.source as keyof typeof t.source] ?? c.source}
                    {c.utm_campaign && <span className="block truncate text-muted">{c.utm_campaign}</span>}
                  </td>
                  <td className="num px-3 py-3 text-end">{c.lead_score ?? "—"}</td>
                  <td className="num px-3 py-3 text-end whitespace-nowrap">{c.deal_value ? formatMoney(c.deal_value, locale, "SAR", true) : "—"}</td>
                  <td className="px-3 py-3">
                    {c.owner_name ? (
                      <span className="flex items-center gap-2"><Avatar name={c.owner_name} className="h-6 w-6 text-[9px]" /><span className="truncate text-xs">{c.owner_name}</span></span>
                    ) : (
                      <span className="text-xs text-muted">{t.common.unassigned}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs whitespace-nowrap text-muted">{formatDate(c.created_at, locale)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-raised hover:text-fg" aria-label={t.clients.call}>
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      {wa && (
                        <a href={wa} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-raised hover:text-lime" aria-label={t.clients.whatsapp}>
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className={cn("divide-y divide-line md:hidden", pending && "opacity-60")}>
        {rows.map((c) => {
          const wa = whatsappLink(c.phone);
          return (
            <li key={c.id} className="flex items-start gap-3 px-4 py-3.5">
              <input type="checkbox" aria-label="Select" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="mt-1 accent-lime" />
              <Link prefetch={false} href={`/clients/${c.id}`} className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium">{c.company_name ?? c.contact_name ?? "—"}</p>
                  <Badge tone={STATUS_TONE[c.status]}>{t.status[c.status]}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {[c.company_name ? c.contact_name : null, t.source[c.source as keyof typeof t.source]].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2 flex items-center gap-3 text-xs text-soft">
                  {c.deal_value ? <span className="num">{formatMoney(c.deal_value, locale, "SAR", true)}</span> : null}
                  {c.lead_score != null && <span>{t.clients.score}: <span className="num">{c.lead_score}</span></span>}
                  <span className="ms-auto text-muted">{c.owner_name ?? t.common.unassigned}</span>
                </div>
              </Link>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-lime" aria-label={t.clients.whatsapp}>
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
