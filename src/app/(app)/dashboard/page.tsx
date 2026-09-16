import Link from "next/link";
import { AlarmClock, CalendarClock, Gauge, TrendingDown, TrendingUp, UserX } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboard, parseRange } from "@/lib/dashboard";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { STATUS_TONE, type Status } from "@/lib/constants";
import { cn, formatDate, formatMoney, formatTime, relativeTime } from "@/lib/utils";
import { Avatar, Badge, Card, CardTitle, EmptyState, LinkButton } from "@/components/ui";
import { BarList } from "@/components/dashboard/bar-list";
import { StageDonut, TrendChart } from "@/components/dashboard/charts";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const range = parseRange((await searchParams).range);
  const d = await getDashboard(range, user.id);
  const td = t.dashboard;

  const ranges = [
    { v: "30", label: td.range30 },
    { v: "90", label: td.range90 },
    { v: "365", label: td.range365 },
    { v: "all", label: td.rangeAll },
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{formatDate(new Date(), locale, { weekday: "long", day: "numeric", month: "long", year: undefined })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-[1.75rem]">{fmt(td.greeting, { name: user.name.split(" ")[0] })}</h1>
        </div>
        <nav className="flex rounded-full bg-panel p-1 ring-1 ring-inset ring-line" aria-label="Range">
          {ranges.map((r) => (
            <Link prefetch={false}
              key={r.v}
              href={`/dashboard?range=${r.v}`}
              aria-current={range === r.v ? "true" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] transition-colors",
                range === r.v ? "bg-lime font-medium text-black" : "text-muted hover:text-fg",
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Headline numbers */}
      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Card className="brand-glow relative col-span-2 overflow-hidden p-5 ring-0 md:p-6 lg:row-span-2">
          <p className="text-sm text-white/70">{td.pipelineValue}</p>
          <p className="num mt-2 text-4xl font-semibold tracking-tight md:text-5xl">{formatMoney(d.kpi.pipeline_value, locale)}</p>
          <p className="mt-2 text-sm text-white/70">{fmt(td.pipelineHint, { count: d.kpi.open_deals })}</p>
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/15 pt-5">
            <div>
              <p className="text-xs text-white/60">{td.wonRevenue}</p>
              <p className="num mt-1 text-xl font-semibold">{formatMoney(d.kpi.won_value, locale, "SAR", true)}</p>
              <p className="mt-0.5 text-xs text-white/60">{fmt(td.wonDeals, { count: d.kpi.won_count })}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">{td.winRate}</p>
              <p className="num mt-1 text-xl font-semibold">{d.kpi.win_rate == null ? "—" : `${d.kpi.win_rate}%`}</p>
              <p className="mt-0.5 text-xs text-white/60">{td.winRateHint}</p>
            </div>
          </div>
        </Card>

        <Kpi label={td.newLeads} value={d.kpi.new_leads} href="/clients?sort=newest">
          {d.kpi.lead_change != null && (
            <span className={cn("inline-flex items-center gap-1 text-xs", d.kpi.lead_change >= 0 ? "text-lime" : "text-danger")}>
              {d.kpi.lead_change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span className="num">{d.kpi.lead_change > 0 ? "+" : ""}{d.kpi.lead_change}%</span>
              <span className="text-muted">{td.vsPrevious}</span>
            </span>
          )}
        </Kpi>
        <Kpi label={td.meetingsWeek} value={d.kpi.meetings_week} icon={<CalendarClock className="h-4 w-4" />} href="/calendar" />
        <Kpi label={td.overdueTasks} value={d.kpi.overdue_tasks} icon={<AlarmClock className="h-4 w-4" />} href="/tasks" alert={d.kpi.overdue_tasks > 0} />
        <Kpi label={td.unassigned} value={d.kpi.unassigned} icon={<UserX className="h-4 w-4" />} href="/clients?owner=none&status=open" alert={d.kpi.unassigned > 0} />
      </section>

      {/* Trend + stages */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle
            action={
              d.kpi.avg_score != null && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Gauge className="h-3.5 w-3.5" /> {td.avgScore} <span className="num font-medium text-fg">{d.kpi.avg_score}</span>
                </span>
              )
            }
          >
            {td.leadsOverTime}
          </CardTitle>
          <div className="px-3 pb-4">
            <TrendChart data={d.trend} bucket={d.bucket} />
          </div>
        </Card>
        <Card>
          <CardTitle action={<Link prefetch={false} href="/pipeline" className="text-xs text-muted hover:text-lime">{t.nav.pipeline}</Link>}>{td.byStage}</CardTitle>
          <div className="px-5 pb-5">
            <StageDonut data={d.byStage} />
          </div>
        </Card>
      </section>

      {/* Marketing attribution */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardTitle>{td.bySource}</CardTitle>
          <BarList
            empty={td.noData}
            items={d.bySource.map((s) => ({ label: t.source[s.key as keyof typeof t.source] ?? s.key, value: s.count }))}
          />
        </Card>
        <Card>
          <CardTitle>{td.byService}</CardTitle>
          <BarList
            empty={td.noData}
            accent="bg-white/80"
            items={d.byService.map((s) => ({ label: t.service[s.key as keyof typeof t.service] ?? s.key, value: s.count }))}
          />
        </Card>
        <Card className="md:col-span-2 lg:col-span-1">
          <CardTitle>{td.byCampaign}</CardTitle>
          <BarList
            empty={td.noData}
            items={d.byCampaign.map((c) => ({
              label: c.key ?? td.noCampaign,
              value: c.count,
              hint: c.won ? `${c.won} ${td.won}` : undefined,
            }))}
          />
        </Card>
      </section>

      {/* Work lists */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle action={<Link prefetch={false} href="/calendar" className="text-xs text-muted hover:text-lime">{t.nav.calendar}</Link>}>{td.upcoming}</CardTitle>
          {d.upcoming.length === 0 ? (
            <EmptyState>{t.calendar.noMeetings}</EmptyState>
          ) : (
            <ul className="divide-y divide-line px-5 pb-2">
              {d.upcoming.map((m) => (
                <li key={m.id} className="flex gap-4 py-3">
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-[11px] text-muted">{formatDate(m.starts_at, locale, { month: "short", year: undefined, day: undefined })}</p>
                    <p className="num text-xl leading-tight font-semibold">{formatDate(m.starts_at, locale, { day: "numeric", month: undefined, year: undefined })}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="truncate text-xs text-muted">
                      <span className="num">{formatTime(m.starts_at, locale)}</span>
                      {m.client_name && <> · {m.client_name}</>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle action={<Link prefetch={false} href="/tasks" className="text-xs text-muted hover:text-lime">{t.nav.tasks}</Link>}>{td.dueTasks}</CardTitle>
          {d.dueTasks.length === 0 ? (
            <EmptyState>{t.tasks.empty}</EmptyState>
          ) : (
            <ul className="divide-y divide-line px-5 pb-2">
              {d.dueTasks.map((task) => {
                const overdue = task.due_at && new Date(task.due_at) < new Date();
                return (
                  <li key={task.id} className="py-3">
                    <p className="truncate text-sm">{task.title}</p>
                    <p className={cn("mt-0.5 truncate text-xs", overdue ? "text-danger" : "text-muted")}>
                      {task.due_at ? relativeTime(task.due_at, locale) : t.tasks.noDate}
                      {task.client_name && task.client_id && (
                        <>
                          {" · "}
                          <Link prefetch={false} href={`/clients/${task.client_id}`} className="hover:text-lime">{task.client_name}</Link>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle action={<Link prefetch={false} href="/clients" className="text-xs text-muted hover:text-lime">{t.nav.clients}</Link>}>{td.recentLeads}</CardTitle>
          {d.recent.length === 0 ? (
            <EmptyState action={<LinkButton href="/import" size="sm">{t.nav.import}</LinkButton>}>{t.clients.emptyAll}</EmptyState>
          ) : (
            <ul className="divide-y divide-line px-5 pb-2">
              {d.recent.map((c) => (
                <li key={c.id}>
                  <Link prefetch={false} href={`/clients/${c.id}`} className="flex items-center gap-3 py-3 hover:text-lime">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.company_name ?? c.contact_name ?? "—"}</p>
                      <p className="truncate text-xs text-muted">
                        {t.source[c.source as keyof typeof t.source] ?? c.source} · {relativeTime(c.created_at, locale)}
                      </p>
                    </div>
                    {c.lead_score != null && <span className="num text-xs text-muted">{c.lead_score}</span>}
                    <Badge tone={STATUS_TONE[c.status as Status]}>{t.status[c.status as Status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Team */}
      <Card>
        <CardTitle>{td.team}</CardTitle>
        <div className="overflow-x-auto px-2 pb-3">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-start text-xs text-muted">
                <th className="px-3 py-2 text-start font-normal">{td.owner}</th>
                <th className="px-3 py-2 text-end font-normal">{td.leads}</th>
                <th className="px-3 py-2 text-end font-normal">{td.won}</th>
                <th className="px-3 py-2 text-end font-normal">{td.wonRevenue}</th>
                <th className="px-3 py-2 text-end font-normal">{td.pipelineValue}</th>
              </tr>
            </thead>
            <tbody>
              {d.team.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-3 py-2.5">
                    <Link prefetch={false} href={`/clients?owner=${m.id}`} className="flex items-center gap-2.5 hover:text-lime">
                      <Avatar name={m.name} className="h-7 w-7 text-[10px]" />
                      {m.name}
                    </Link>
                  </td>
                  <td className="num px-3 py-2.5 text-end">{m.leads}</td>
                  <td className="num px-3 py-2.5 text-end">{m.won}</td>
                  <td className="num px-3 py-2.5 text-end">{formatMoney(m.won_value, locale)}</td>
                  <td className="num px-3 py-2.5 text-end text-soft">{formatMoney(m.open_value, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  href,
  alert,
  children,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  href: string;
  alert?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Link prefetch={false} href={href} className="group">
      <Card className="flex h-full flex-col justify-between gap-3 p-4 transition-colors group-hover:ring-line-strong md:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] leading-snug text-muted">{label}</p>
          {icon && <span className={cn(alert ? "text-danger" : "text-muted")}>{icon}</span>}
        </div>
        <div>
          <p className={cn("num text-3xl font-semibold tracking-tight", alert && "text-danger")}>{value}</p>
          {children && <div className="mt-1">{children}</div>}
        </div>
      </Card>
    </Link>
  );
}
