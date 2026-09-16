"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CheckSquare, Columns3, FileSpreadsheet, LayoutDashboard, Settings, Users } from "lucide-react";
import { Logo, SlashLines } from "@/components/brand";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/clients", key: "clients", icon: Users },
  { href: "/pipeline", key: "pipeline", icon: Columns3 },
  { href: "/calendar", key: "calendar", icon: CalendarDays },
  { href: "/tasks", key: "tasks", icon: CheckSquare },
  { href: "/import", key: "import", icon: FileSpreadsheet },
  { href: "/settings", key: "settings", icon: Settings },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ user }: { user: { name: string; role: string } }) {
  const { t } = useI18n();
  const isActive = useActive();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col overflow-hidden border-e border-line bg-canvas lg:flex">
      <div className="px-6 pt-6 pb-8">
        <Link prefetch={false} href="/dashboard" aria-label="Codevia CRM">
          <Logo />
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 px-3">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link prefetch={false}
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active ? "bg-raised text-fg" : "text-muted hover:text-fg",
              )}
            >
              <span
                className={cn(
                  "absolute inset-y-2 start-0 w-[3px] rounded-full bg-lime transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-lime" : "")} aria-hidden />
              {t.nav[key]}
            </Link>
          );
        })}
      </nav>
      <div className="relative mt-auto h-48 overflow-hidden">
        <SlashLines className="opacity-70" />
        <div className="absolute inset-x-6 bottom-6">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted">{t.role[user.role as keyof typeof t.role] ?? user.role}</p>
        </div>
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const { t } = useI18n();
  const isActive = useActive();
  const items = ITEMS.filter((i) => ["dashboard", "clients", "pipeline", "calendar", "tasks"].includes(i.key));
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/90 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, key, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link prefetch={false}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", active ? "text-lime" : "text-muted")}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {t.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
