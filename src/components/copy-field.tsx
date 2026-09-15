"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function CopyField({ value, className, secret }: { value: string; className?: string; secret?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] bg-canvas p-1 ps-3 ring-1 ring-inset ring-line-strong", secret && "ring-lime/60", className)}>
      <code dir="ltr" className="min-w-0 flex-1 truncate text-start font-mono text-[13px] text-soft">{value}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            const el = document.createElement("textarea");
            el.value = value;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            el.remove();
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-raised px-3 text-xs font-medium text-fg ring-1 ring-inset ring-line-strong hover:ring-lime"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-lime" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        {copied ? t.common.copied : t.common.copy}
      </button>
    </div>
  );
}
