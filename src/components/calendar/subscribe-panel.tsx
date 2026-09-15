"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, RefreshCw, ShieldAlert } from "lucide-react";
import { resetCalendarToken } from "@/lib/actions/settings";
import type { FeedUrls } from "@/lib/app-url";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { buttonClass, Button } from "@/components/ui";
import { CopyField } from "@/components/copy-field";

/** Shared by the calendar subscribe dialog and Settings → Calendar feed. */
export function SubscribePanel({ feeds }: { feeds: FeedUrls }) {
  const { t } = useI18n();
  const tc = t.calendar;
  const router = useRouter();
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [pending, start] = useTransition();
  const feed = feeds[scope];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-soft">{tc.subscribeBody}</p>

      <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-full bg-canvas p-1 ring-1 ring-inset ring-line-strong">
        {(["all", "mine"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={scope === s}
            onClick={() => setScope(s)}
            className={cn("h-9 rounded-full px-3 text-sm transition-colors", scope === s ? "bg-lime font-medium text-black" : "text-soft hover:text-fg")}
          >
            {s === "all" ? tc.subscribeAll : tc.subscribeMine}
          </button>
        ))}
      </div>

      <a href={feed.webcal} className={buttonClass("primary", "md", "justify-center")}>
        <CalendarCheck className="h-4 w-4" aria-hidden />
        {tc.subscribeOpen}
      </a>

      <CopyField value={feed.https} />

      <p className="text-xs leading-relaxed text-muted">{tc.subscribeSteps}</p>
      <p className="text-xs leading-relaxed text-muted">{tc.googleToo}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warn/10 px-4 py-3 ring-1 ring-inset ring-warn/25">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-warn">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {tc.subscribeWarning}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (!confirm(tc.resetConfirm)) return;
            start(async () => {
              await resetCalendarToken();
              router.refresh();
            });
          }}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} aria-hidden />
          {tc.resetLink}
        </Button>
      </div>
    </div>
  );
}
