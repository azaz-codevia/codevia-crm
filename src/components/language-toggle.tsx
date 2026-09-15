"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLocale } from "@/lib/actions/auth";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setLocale(locale === "ar" ? "en" : "ar");
          router.refresh();
        })
      }
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm text-soft ring-1 ring-inset ring-line-strong hover:text-fg disabled:opacity-60",
        className,
      )}
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span lang={locale === "ar" ? "en" : "ar"}>{t.common.switchLanguage}</span>
    </button>
  );
}
