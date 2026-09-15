"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { searchClients } from "@/lib/actions/crm";
import { useI18n } from "@/lib/i18n/client";
import { Input } from "@/components/ui";

export type PickedClient = { id: string; label: string } | null;

export function ClientPicker({ name, value, onChange }: { name: string; value: PickedClient; onChange: (v: PickedClient) => void }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ id: string; label: string; sub: string | null }[]>([]);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(async () => setResults(await searchClients(q)), 200);
    return () => clearTimeout(handle);
  }, [q, open]);

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between gap-2 rounded-[var(--radius-control)] bg-raised px-3 text-sm ring-1 ring-inset ring-line-strong">
        <input type="hidden" name={name} value={value.id} />
        <span className="truncate">{value.label}</span>
        <button type="button" onClick={() => onChange(null)} className="text-muted hover:text-fg" aria-label={t.common.clear}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        value={q}
        placeholder={t.calendar.searchClient}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-xl bg-raised p-1 shadow-2xl shadow-black ring-1 ring-line-strong">
          {results.map((r) => (
            <li key={r.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ id: r.id, label: r.label });
                  setQ("");
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-panel"
              >
                <span className="block truncate">{r.label}</span>
                {r.sub && <span className="block truncate text-xs text-muted">{r.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
