import { requireUser } from "@/lib/auth";
import { calendarFeedUrls, getAppUrl } from "@/lib/app-url";
import { getI18n } from "@/lib/i18n/server";
import { getMeetingsBetween, getTeam } from "@/lib/queries";
import { dayKey, zonedInputToUtc } from "@/lib/utils";
import { CalendarView } from "@/components/calendar/calendar-view";

export const metadata = { title: "Calendar" };

function currentMonth() {
  return dayKey(new Date()).slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; owner?: string }>;
}) {
  const user = await requireUser();
  await getI18n();
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonth();
  const view = sp.view === "agenda" ? "agenda" : "month";
  const ownerId = sp.owner === "me" ? user.id : sp.owner && /^[0-9a-f-]{36}$/i.test(sp.owner) ? sp.owner : undefined;

  // Grid: weeks start on Sunday (Saudi work week). Pad a week on each side for the visible grid.
  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const gridStart = new Date(Date.UTC(y, m - 1, 1 - firstDow));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks = Math.ceil((firstDow + daysInMonth) / 7);
  const gridEnd = new Date(gridStart.getTime() + weeks * 7 * 86_400_000);

  const from = zonedInputToUtc(gridStart.toISOString().slice(0, 10))!;
  const to = zonedInputToUtc(gridEnd.toISOString().slice(0, 10))!;

  const [meetings, team, base] = await Promise.all([getMeetingsBetween(from, to, ownerId), getTeam(), getAppUrl()]);

  return (
    <CalendarView
      month={month}
      prevMonth={shiftMonth(month, -1)}
      nextMonth={shiftMonth(month, 1)}
      todayMonth={currentMonth()}
      today={dayKey(new Date())}
      gridStart={gridStart.toISOString().slice(0, 10)}
      weeks={weeks}
      view={view}
      owner={sp.owner ?? ""}
      meetings={meetings}
      team={team.map((t) => ({ id: t.id, name: t.name }))}
      currentUserId={user.id}
      feeds={calendarFeedUrls(base, user.calendar_token)}
    />
  );
}
