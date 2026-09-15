"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createApiKey, revokeApiKey } from "@/lib/actions/settings";
import { SOURCES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";
import { Badge, Button, Card, CardTitle, Field, Input, Select } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { SubmitButton } from "@/components/submit-button";

export type ApiKeyRow = { id: string; name: string; key_prefix: string; default_source: string; last_used_at: Date | null; revoked_at: Date | null; created_at: Date };
export type WebhookLogRow = { id: string; outcome: "created" | "updated" | "rejected" | "error"; client_id: string | null; client_name: string | null; error: string | null; key_name: string | null; created_at: Date };

const OUTCOME_TONE = { created: "tone-won", updated: "tone-contacted", rejected: "tone-medium", error: "tone-lost" } as const;

export function IntegrationsPanel({ endpoint, keys, logs, canManage, fieldNames }: { endpoint: string; keys: ApiKeyRow[]; logs: WebhookLogRow[]; canManage: boolean; fieldNames: { field: string; aliases: string }[] }) {
  const { t, locale } = useI18n();
  const ts = t.settings;
  const router = useRouter();
  const [state, action] = useActionState(createApiKey, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const curl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer cvk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "company": "Al Noor Trading",
    "name": "Faisal Alharbi",
    "email": "faisal@alnoor.sa",
    "phone": "0551234567",
    "city": "Jeddah",
    "services": ["erp", "mobile_app"],
    "budget": "100k-250k SAR",
    "timeline": "Next quarter",
    "message": "Inventory across 6 branches",
    "lead_score": 82,
    "utm": { "source": "instagram", "medium": "paid", "campaign": "ramadan-2026" },
    "answers": { "current_system": "Excel", "branches": 6 }
  }'`;

  const nextjs = `// discovery site — app/api/submit/route.ts (server side, key stays secret)
await fetch(process.env.CRM_WEBHOOK_URL!, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.CRM_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ ...formValues, utm, answers }),
});`;

  return (
    <div className="flex flex-col gap-4">
      <Card className="brand-glow relative overflow-hidden p-5 ring-0 md:p-6">
        <h2 className="text-lg font-semibold">{ts.connectorTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/75">{ts.connectorBody}</p>
        <div className="mt-4 max-w-2xl">
          <p className="mb-1.5 text-xs text-white/60">{ts.endpoint} · POST</p>
          <CopyField value={endpoint} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardTitle>{ts.apiKeys}</CardTitle>
          {canManage ? (
            <form ref={formRef} action={action} className="grid gap-3 px-5 pb-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label={ts.keyName}>
                <Input name="name" required placeholder={ts.keyNamePlaceholder} />
              </Field>
              <Field label={ts.keySource}>
                <Select name="default_source" defaultValue="discovery">
                  {SOURCES.map((s) => <option key={s} value={s}>{t.source[s]}</option>)}
                </Select>
              </Field>
              <SubmitButton pendingLabel={t.common.loading}>
                <KeyRound className="h-4 w-4" aria-hidden /> {ts.createKey}
              </SubmitButton>
            </form>
          ) : (
            <p className="px-5 pb-4 text-sm text-muted">{t.errors.forbidden}</p>
          )}
          {state?.secret && (
            <div className="mx-5 mb-4 rounded-2xl bg-lime/10 p-3 ring-1 ring-inset ring-lime/30">
              <p className="mb-2 text-sm text-lime">{ts.keyCreated}</p>
              <CopyField value={state.secret} secret />
            </div>
          )}
          {keys.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">{ts.noKeys}</p>
          ) : (
            <ul className="divide-y divide-line px-5 pb-3">
              {keys.map((k) => (
                <li key={k.id} className={cn("flex items-center gap-3 py-3", k.revoked_at && "opacity-50")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{k.name}</p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                      <code dir="ltr" className="font-mono">{k.key_prefix}…</code>
                      <span>{t.source[k.default_source as keyof typeof t.source] ?? k.default_source}</span>
                      <span>{ts.lastUsed}: {k.last_used_at ? relativeTime(k.last_used_at, locale) : ts.never}</span>
                    </p>
                  </div>
                  {k.revoked_at ? (
                    <Badge>{ts.revoked}</Badge>
                  ) : (
                    canManage && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(t.common.confirmDelete)) return;
                          start(async () => {
                            await revokeApiKey(k.id);
                            router.refresh();
                          });
                        }}
                      >
                        {ts.revoke}
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>{ts.logs}</CardTitle>
          {logs.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">{ts.noLogs}</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto px-5 pb-3">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Badge tone={OUTCOME_TONE[l.outcome]}>{ts.outcome[l.outcome]}</Badge>
                  <div className="min-w-0 flex-1">
                    {l.client_id ? (
                      <a href={`/clients/${l.client_id}`} className="block truncate hover:text-lime">{l.client_name ?? "—"}</a>
                    ) : (
                      <p dir="ltr" className="truncate text-start font-mono text-xs text-muted">{l.error}</p>
                    )}
                    <p className="text-xs text-muted">
                      <span className="num">{formatDateTime(l.created_at, locale)}</span>
                      {l.key_name && ` · ${l.key_name}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>{ts.example}</CardTitle>
        <div className="grid gap-3 px-5 pb-5 lg:grid-cols-2">
          {[curl, nextjs].map((code, i) => (
            <pre key={i} dir="ltr" className="overflow-x-auto rounded-2xl bg-canvas p-4 text-start font-mono text-[12.5px] leading-relaxed text-soft ring-1 ring-inset ring-line">
              {code}
            </pre>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{ts.fields}</CardTitle>
        <p className="-mt-1 px-5 pb-3 text-sm text-muted">{ts.fieldsBody}</p>
        <dl className="grid gap-x-6 px-5 pb-5 sm:grid-cols-2">
          {fieldNames.map((f) => (
            <div key={f.field} className="flex flex-col gap-0.5 border-b border-line py-2">
              <dt dir="ltr" className="text-start font-mono text-[13px] text-lime">{f.field}</dt>
              <dd className="text-xs text-muted">{f.aliases}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
