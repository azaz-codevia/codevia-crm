"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin, Smartphone, Video } from "lucide-react";
import type { FeedUrls } from "@/lib/app-url";
import { useI18n } from "@/lib/i18n/client";
import type { MeetingRow } from "@/lib/queries";
import { cn, dayKey, formatDate, formatTime, intlLocale } from "@/lib/utils";
import { Dialog } from "@/components/dialog";
import { MeetingDialog, type MeetingDraft } from "@/components/meetings/meeting-dialog";
import { Avatar, Button, buttonClass, Card, EmptyState, PageHeader, Select } from "@/components/ui";
import { SubscribePanel } from "./subscribe-panel";

type Props = {
  month: string;
  prevMonth: string;
  nextMonth: string;
  todayMonth: string;
  today: string;
  gridStart: string;
  weeks: number;
  view: "month" | "agenda";
  owner: string;
  meetings: MeetingRow[];
  team: { id: string; name: string }[];
  currentUserId: string;
  feeds: FeedUrls;
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function CalendarView(p: Props) {
  const { t, locale } = useI18n();
  const tc = t.calendar;
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<MeetingDraft | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(p.month === p.todayMonth ? p.today : `${p.month}-01`);

  const href = (patch: Partial<{ month: string; view: string; owner: string }>) => {
    const qs = new URLSearchParams();
    const next = { month: p.month, view: p.view, owner: p.owner, ...patch };
    if (next.month !== p.todayMonth) qs.set("month", next.month);
    if (next.view !== "month") qs.set("view", next.view);
    if (next.owner) qs.set("owner", next.owner);
    const s = qs.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const byDay = useMemo(() => {
    const map = new Map<string, MeetingRow[]>();
    for (const m of p.meetings) {
      const k = dayKey(m.starts_at);
      const list = map.get(k) ?? [];
      list.push(m);
      map.set(k, list);
    }
    return map;
  }, [p.meetings]);

  const monthLabel = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${p.month}-01T00:00:00Z`),
  );
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(`${addDays(p.gridStart, i)}T00:00:00Z`)));
  const days = Array.from({ length: p.weeks * 7 }, (_, i) => addDays(p.gridStart, i));
  const monthMeetings = p.meetings.filter((m) => dayKey(m.starts_at).startsWith(p.month));
  const Prev = locale === "ar" ? ChevronRight : ChevronLeft;
  const Next = locale === "ar" ? ChevronLeft : ChevronRight;

  const openNew = (day?: string) => setDraft({ startLocal: `${day ?? (p.month === p.todayMonth ? p.today : `${p.month}-01`)}T10:00` });

  const chip = (m: MeetingRow) => (
    <button
      key={m.id}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(m);
      }}
      className={cn(
        "block w-full truncate rounded-md px-1.5 py-0.5 text-start text-[11px] leading-snug",
        m.status === "cancelled" ? "bg-raised text-muted line-through" : m.status === "completed" ? "bg-raised text-soft" : "bg-lime/15 text-lime hover:bg-lime/25",
      )}
      title={m.title}
    >
      <span className="num me-1 opacity-80">{formatTime(m.starts_at, locale)}</span>
      {m.title}
    </button>
  );

  const agendaItem = (m: MeetingRow) => (
    <li key={m.id}>
      <button type="button" onClick={() => setDraft(m)} className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-start hover:bg-raised">
        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            m.status === "scheduled" ? "bg-lime" : m.status === "completed" ? "bg-soft" : "bg-danger",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-sm font-medium", m.status === "cancelled" && "text-muted line-through")}>{m.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="num inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {formatTime(m.starts_at, locale)} – {formatTime(m.ends_at, locale)}
            </span>
            {m.client_name && <span className="truncate text-soft">{m.client_name}</span>}
            {m.location && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3" aria-hidden />
                {m.location}
              </span>
            )}
            {m.meeting_url && <Video className="h-3 w-3" aria-label={tc.meetingUrl} />}
          </span>
        </span>
        {m.owner_name && <Avatar name={m.owner_name} className="h-7 w-7 text-[10px]" />}
      </button>
    </li>
  );

  const selectedMeetings = byDay.get(selectedDay) ?? [];

  return (
    <div>
      <PageHeader
        title={tc.title}
        actions={
          <>
            <Button variant="secondary" onClick={() => setSubscribeOpen(true)}>
              <Smartphone className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{tc.subscribe}</span>
            </Button>
            <Button onClick={() => openNew()}>
              <CalendarPlus className="h-4 w-4" aria-hidden />
              {tc.newMeeting}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link prefetch={false} href={href({ month: p.prevMonth })} className={buttonClass("secondary", "icon")} aria-label={t.common.previous}>
            <Prev className="h-4 w-4" />
          </Link>
          <Link prefetch={false} href={href({ month: p.nextMonth })} className={buttonClass("secondary", "icon")} aria-label={t.common.next}>
            <Next className="h-4 w-4" />
          </Link>
        </div>
        <h2 className="min-w-36 px-1 text-lg font-medium">{monthLabel}</h2>
        {p.month !== p.todayMonth && (
          <Link prefetch={false} href={href({ month: p.todayMonth })} className={buttonClass("ghost", "sm")}>
            {t.common.today}
          </Link>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Select value={p.owner} onChange={(e) => router.push(href({ owner: e.target.value }))} className="w-auto min-w-40 rounded-full" aria-label={tc.owner}>
            <option value="">{tc.owner}: {t.common.all}</option>
            <option value="me">{t.common.you}</option>
            {p.team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <div className="hidden rounded-full bg-panel p-1 ring-1 ring-inset ring-line md:flex">
            {(["month", "agenda"] as const).map((v) => (
              <Link prefetch={false}
                key={v}
                href={href({ view: v })}
                className={cn("rounded-full px-3 py-1 text-sm", p.view === v ? "bg-raised text-fg" : "text-muted hover:text-fg")}
              >
                {tc[v]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop month grid */}
      {p.view === "month" && (
        <Card className="hidden overflow-hidden md:block">
          <div className="grid grid-cols-7 border-b border-line">
            {weekdays.map((w) => (
              <div key={w} className="px-3 py-2 text-xs font-medium text-muted">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.startsWith(p.month);
              return (
                <div
                  key={d}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNew(d)}
                  onKeyDown={(e) => e.key === "Enter" && openNew(d)}
                  className={cn(
                    "group min-h-28 cursor-pointer border-line p-1.5 transition-colors hover:bg-raised/50",
                    i % 7 !== 6 && "border-e",
                    i < (p.weeks - 1) * 7 && "border-b",
                    !inMonth && "bg-canvas/40",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span
                      className={cn(
                        "num grid h-6 min-w-6 place-items-center rounded-full text-xs",
                        d === p.today ? "bg-lime font-semibold text-black" : inMonth ? "text-soft" : "text-muted/50",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    <CalendarPlus className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100" aria-hidden />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {list.slice(0, 3).map(chip)}
                    {list.length > 3 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(href({ view: "agenda" }));
                        }}
                        className="px-1.5 text-start text-[11px] text-muted hover:text-fg"
                      >
                        +{list.length - 3}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Mobile: compact month + selected day list */}
      <div className={cn("md:hidden", p.view === "agenda" && "hidden")}>
        <Card className="p-3">
          <div className="grid grid-cols-7 text-center">
            {weekdays.map((w) => (
              <div key={w} className="pb-2 text-[11px] text-muted">{w}</div>
            ))}
            {days.map((d) => {
              const count = byDay.get(d)?.length ?? 0;
              const inMonth = d.startsWith(p.month);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className="flex flex-col items-center gap-0.5 py-1"
                  aria-pressed={selectedDay === d}
                >
                  <span
                    className={cn(
                      "num grid h-8 w-8 place-items-center rounded-full text-sm",
                      selectedDay === d ? "bg-lime font-semibold text-black" : d === p.today ? "text-lime ring-1 ring-lime" : inMonth ? "text-fg" : "text-muted/40",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <span className={cn("h-1 w-1 rounded-full", count ? "bg-lime" : "bg-transparent")} />
                </button>
              );
            })}
          </div>
        </Card>
        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-soft">{formatDate(`${selectedDay}T12:00:00Z`, locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</h3>
          <Button size="sm" variant="ghost" onClick={() => openNew(selectedDay)}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> {tc.newMeeting}
          </Button>
        </div>
        {selectedMeetings.length ? (
          <ul className="mt-1 flex flex-col">{selectedMeetings.map(agendaItem)}</ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted">{t.pipeline.empty}</p>
        )}
      </div>

      {/* Agenda (desktop when selected; mobile when view=agenda) */}
      <div className={cn(p.view === "agenda" ? "block" : "hidden")}>
        <Card className="p-2 sm:p-3">
          {monthMeetings.length === 0 ? (
            <EmptyState action={<Button size="sm" onClick={() => openNew()}>{tc.newMeeting}</Button>}>{tc.noMeetings}</EmptyState>
          ) : (
            Array.from(new Set(monthMeetings.map((m) => dayKey(m.starts_at)))).map((d) => (
              <section key={d} className="py-1">
                <h3 className={cn("px-3 py-2 text-xs font-medium", d === p.today ? "text-lime" : "text-muted")}>
                  {formatDate(`${d}T12:00:00Z`, locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}
                </h3>
                <ul>{(byDay.get(d) ?? []).map(agendaItem)}</ul>
              </section>
            ))
          )}
        </Card>
      </div>
      <div className="mt-3 flex justify-center md:hidden">
        <Link prefetch={false} href={href({ view: p.view === "agenda" ? "month" : "agenda" })} className={buttonClass("ghost", "sm")}>
          {p.view === "agenda" ? tc.month : tc.agenda}
        </Link>
      </div>

      <MeetingDialog draft={draft} onClose={() => setDraft(null)} team={p.team} currentUserId={p.currentUserId} />
      <Dialog open={subscribeOpen} onClose={() => setSubscribeOpen(false)} title={tc.subscribeTitle}>
        <SubscribePanel feeds={p.feeds} />
      </Dialog>
    </div>
  );
}
