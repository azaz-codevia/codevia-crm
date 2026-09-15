"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, LogOut, Search, Settings } from "lucide-react";
import { Logo } from "@/components/brand";
import { Avatar } from "@/components/ui";
import { LanguageToggle } from "@/components/language-toggle";
import { logout } from "@/lib/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export function Topbar({ user }: { user: { name: string; email: string } }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-lg"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="lg:hidden" aria-label="Codevia CRM">
          <Logo compact />
        </Link>
        <form
          role="search"
          className="relative flex-1 md:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            router.push(`/clients${q ? `?q=${encodeURIComponent(String(q))}` : ""}`);
          }}
        >
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            type="search"
            placeholder={t.nav.search}
            aria-label={t.nav.search}
            className="h-10 w-full rounded-full bg-panel ps-9 pe-4 text-sm ring-1 ring-inset ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-lime"
          />
        </form>
        <div className="ms-auto flex items-center gap-2">
          <LanguageToggle className="hidden sm:inline-flex" />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              className="rounded-full"
            >
              <Avatar name={user.name} className="h-9 w-9" />
            </button>
            {open && (
              <div
                role="menu"
                className="absolute end-0 mt-2 w-60 overflow-hidden rounded-2xl bg-raised p-1.5 shadow-2xl shadow-black ring-1 ring-line-strong"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted" dir="ltr">{user.email}</p>
                </div>
                <div className="my-1 h-px bg-line" />
                <Link role="menuitem" href="/import" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-soft hover:bg-panel hover:text-fg lg:hidden">
                  <FileSpreadsheet className="h-4 w-4" aria-hidden /> {t.nav.import}
                </Link>
                <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-soft hover:bg-panel hover:text-fg">
                  <Settings className="h-4 w-4" aria-hidden /> {t.nav.settings}
                </Link>
                <LanguageToggle className="mx-1 my-1 w-[calc(100%-0.5rem)] justify-start ring-0 sm:hidden" />
                <form action={logout}>
                  <button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-soft hover:bg-panel hover:text-fg">
                    <LogOut className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t.nav.signOut}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
