"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { setClientStatus } from "@/lib/actions/crm";
import { STATUS_HEX, STATUS_TONE, STATUSES, type Status } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { cn, formatMoney, relativeTime } from "@/lib/utils";
import { Avatar, Select } from "@/components/ui";

export type KanbanCard = {
  id: string;
  title: string;
  subtitle: string | null;
  status: Status;
  deal_value: number | null;
  lead_score: number | null;
  priority: "low" | "medium" | "high";
  owner_name: string | null;
  updated_at: Date;
  next_follow_up_at: Date | null;
};

export function KanbanBoard({ cards, team, owner }: { cards: KanbanCard[]; team: { id: string; name: string }[]; owner: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  const [optimistic, move] = useOptimistic(cards, (state, { id, status }: { id: string; status: Status }) =>
    state.map((c) => (c.id === id ? { ...c, status } : c)),
  );
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const [mobileStage, setMobileStage] = useState<Status>("new");

  const moveCard = (id: string, status: Status) => {
    const card = optimistic.find((c) => c.id === id);
    if (!card || card.status === status) return;
    start(async () => {
      move({ id, status });
      await setClientStatus([id], status);
      router.refresh();
    });
  };

  const columns = STATUSES.map((s) => {
    const items = optimistic.filter((c) => c.status === s);
    return { status: s, items, total: items.reduce((a, c) => a + (c.deal_value ?? 0), 0) };
  });

  const renderCard = (c: KanbanCard) => (
    <li
      key={c.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", c.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group cursor-grab rounded-2xl bg-raised p-3.5 ring-1 ring-inset ring-line transition-shadow hover:ring-line-strong active:cursor-grabbing"
    >
      <Link href={`/clients/${c.id}`} className="block" draggable={false}>
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium group-hover:text-lime">{c.title}</p>
          {c.priority === "high" && <span className="tone-high dot-tone mt-1.5 h-2 w-2 shrink-0 rounded-full" title={t.priority.high} />}
        </div>
        {c.subtitle && <p className="mt-0.5 truncate text-xs text-muted">{c.subtitle}</p>}
        <div className="mt-3 flex items-center gap-2 text-xs">
          {c.deal_value ? <span className="num font-medium">{formatMoney(c.deal_value, locale, "SAR", true)}</span> : null}
          {c.lead_score != null && <span className="num rounded-full bg-panel px-1.5 py-0.5 text-muted">{c.lead_score}</span>}
          <span className="ms-auto">{c.owner_name ? <Avatar name={c.owner_name} className="h-6 w-6 text-[9px]" /> : null}</span>
        </div>
        {c.next_follow_up_at && (
          <p className={cn("mt-2 text-[11px]", new Date(c.next_follow_up_at) < new Date() ? "text-danger" : "text-muted")}>
            {t.clients.followUp}: {relativeTime(c.next_follow_up_at, locale)}
          </p>
        )}
      </Link>
      <Select
        aria-label={t.pipeline.moveTo}
        value={c.status}
        onChange={(e) => moveCard(c.id, e.target.value as Status)}
        className="mt-3 h-8 text-xs md:hidden"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{t.pipeline.moveTo}: {t.status[s]}</option>)}
      </Select>
    </li>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={owner} onChange={(e) => router.push(e.target.value ? `${pathname}?owner=${e.target.value}` : pathname)} className="w-auto min-w-44 rounded-full">
          <option value="">{t.clients.owner}: {t.common.all}</option>
          <option value="me">{t.common.you}</option>
          {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </div>

      {/* Mobile: stage tabs */}
      <div className="md:hidden">
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {columns.map((col) => (
            <button
              key={col.status}
              type="button"
              onClick={() => setMobileStage(col.status)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[13px] ring-1 ring-inset",
                mobileStage === col.status ? "bg-raised text-fg ring-line-strong" : "text-muted ring-line",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX[col.status] }} />
              {t.status[col.status]}
              <span className="num text-muted">{col.items.length}</span>
            </button>
          ))}
        </div>
        {(() => {
          const col = columns.find((c) => c.status === mobileStage)!;
          return (
            <>
              <p className="mb-2 text-xs text-muted">{t.pipeline.total}: <span className="num text-soft">{formatMoney(col.total, locale)}</span></p>
              {col.items.length === 0 ? <p className="py-10 text-center text-sm text-muted">{t.pipeline.empty}</p> : <ul className="flex flex-col gap-2">{col.items.map(renderCard)}</ul>}
            </>
          );
        })()}
      </div>

      {/* Desktop: board */}
      <div className="-mx-4 hidden gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 md:flex lg:-mx-8 lg:px-8">
        {columns.map((col) => (
          <section
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.status);
            }}
            onDragLeave={() => setDragOver((s) => (s === col.status ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              moveCard(e.dataTransfer.getData("text/plain"), col.status);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-[var(--radius-card)] bg-panel ring-1 ring-inset transition-colors",
              dragOver === col.status ? "ring-lime" : "ring-line",
            )}
          >
            <header className={cn(STATUS_TONE[col.status], "px-4 pt-4 pb-3")}>
              <div className="flex items-center gap-2">
                <span className="dot-tone h-2 w-2 rounded-full" />
                <h2 className="text-sm font-medium">{t.status[col.status]}</h2>
                <span className="num ms-auto rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{col.items.length}</span>
              </div>
              <p className="num mt-1 text-xs text-muted">{formatMoney(col.total, locale)}</p>
            </header>
            <ul className="flex max-h-[calc(100dvh-280px)] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {col.items.length === 0 ? <li className="py-6 text-center text-xs text-muted">{t.pipeline.empty}</li> : col.items.map(renderCard)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
