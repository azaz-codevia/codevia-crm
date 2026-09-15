"use client";

import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n/client";
import { STATUS_HEX, STATUSES, type Status } from "@/lib/constants";
import { formatMoney, intlLocale } from "@/lib/utils";

type TooltipItem = { name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown> };

function ChartTooltip({ active, payload, label, labelFormatter }: { active?: boolean; payload?: TooltipItem[]; label?: string | number; labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-raised px-3 py-2 text-xs shadow-xl shadow-black ring-1 ring-line-strong">
      {label != null && <p className="mb-1 text-muted">{labelFormatter ? labelFormatter(String(label)) : label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-soft">{p.name}</span>
          <span className="ms-auto ps-3 font-medium text-fg">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data, bucket }: { data: { bucket: string; leads: number; won: number }[]; bucket: string }) {
  const { t, locale } = useI18n();
  const fmt = (v: string) => {
    const d = new Date(v + "T12:00:00Z");
    const opts: Intl.DateTimeFormatOptions =
      bucket === "month" ? { month: "short", year: "2-digit", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" };
    return new Intl.DateTimeFormat(intlLocale(locale), opts).format(d);
  };
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b8d433" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#b8d433" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#25271d" vertical={false} />
          <XAxis dataKey="bucket" tickFormatter={fmt} tick={{ fill: "#8c8f81", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} reversed={locale === "ar"} />
          <YAxis allowDecimals={false} tick={{ fill: "#8c8f81", fontSize: 11 }} axisLine={false} tickLine={false} orientation={locale === "ar" ? "right" : "left"} />
          <Tooltip content={<ChartTooltip labelFormatter={fmt} />} cursor={{ stroke: "#36392b" }} />
          <Area type="monotone" dataKey="leads" name={t.dashboard.leads} stroke="#b8d433" strokeWidth={2} fill="url(#leadsFill)" />
          <Area type="monotone" dataKey="won" name={t.dashboard.won} stroke="#ffffff" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StageDonut({ data }: { data: { key: string; count: number; value: number }[] }) {
  const { t, locale } = useI18n();
  const rows = STATUSES.map((s) => {
    const hit = data.find((d) => d.key === s);
    return { key: s, name: t.status[s], count: hit?.count ?? 0, value: hit?.value ?? 0 };
  });
  const total = rows.reduce((a, r) => a + r.count, 0);
  const chartRows = rows.filter((r) => r.count > 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative h-40 w-40 shrink-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartRows.length ? chartRows : [{ key: "empty", name: "", count: 1 }]} dataKey="count" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={chartRows.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {(chartRows.length ? chartRows : [{ key: "empty" }]).map((r) => (
                <Cell key={r.key} fill={r.key === "empty" ? "#25271d" : STATUS_HEX[r.key as Status]} />
              ))}
            </Pie>
            {chartRows.length > 0 && <Tooltip content={<ChartTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="num text-2xl font-semibold">{total}</p>
            <p className="text-[11px] text-muted">{t.dashboard.deals}</p>
          </div>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        {rows.map((r) => (
          <li key={r.key} className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_HEX[r.key] }} />
            <span className="truncate text-soft">{r.name}</span>
            <span className="num ms-auto font-medium">{r.count}</span>
            {r.value > 0 && <span className="sr-only">{formatMoney(r.value, locale)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
