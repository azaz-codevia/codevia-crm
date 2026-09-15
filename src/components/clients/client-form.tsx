"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { PRIORITIES, SERVICES, SOURCES, STATUSES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { ClientDetail } from "@/lib/queries";
import { utcToZonedInput } from "@/lib/utils";
import { Button, Card, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import type { FormState } from "@/lib/actions/auth";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

export function ClientForm({
  action,
  client,
  team,
  cancelHref,
  currentUserId,
}: {
  action: Action;
  client?: ClientDetail;
  team: { id: string; name: string }[];
  cancelHref: string;
  currentUserId: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, null);
  const [status, setStatus] = useState<string>(client?.status ?? "new");
  const tc = t.clients;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        // Submit manually so React doesn't reset the fields when validation fails
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      {state?.error === "duplicate" && state.duplicateId && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn ring-1 ring-inset ring-warn/30">
          <span>{tc.duplicateWarning}</span>
          <Link href={`/clients/${state.duplicateId}`} className="font-medium underline underline-offset-4">{tc.openExisting}</Link>
          <input type="hidden" name="ignore_duplicate" value="1" />
          <span className="w-full text-warn/80">{tc.duplicateSaveAnyway}</span>
        </div>
      )}
      {state?.error === "required" && (
        <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{t.import.needName}</p>
      )}

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <h2 className="text-[15px] font-medium md:col-span-2">{tc.details}</h2>
        <Field label={tc.company}><Input name="company_name" defaultValue={client?.company_name ?? ""} /></Field>
        <Field label={tc.contact}><Input name="contact_name" defaultValue={client?.contact_name ?? ""} /></Field>
        <Field label={tc.jobTitle}><Input name="job_title" defaultValue={client?.job_title ?? ""} /></Field>
        <Field label={tc.industry}><Input name="industry" defaultValue={client?.industry ?? ""} /></Field>
        <Field label={tc.email}><Input name="email" type="email" dir="ltr" defaultValue={client?.email ?? ""} /></Field>
        <Field label={tc.phone}><Input name="phone" type="tel" dir="ltr" placeholder="+966 5x xxx xxxx" defaultValue={client?.phone ?? ""} /></Field>
        <Field label={tc.city}><Input name="city" defaultValue={client?.city ?? ""} /></Field>
        <Field label={tc.companySize}><Input name="company_size" defaultValue={client?.company_size ?? ""} /></Field>
        <Field label={tc.website}><Input name="website" dir="ltr" defaultValue={client?.website ?? ""} /></Field>
        <Field label={tc.language}>
          <Select name="preferred_language" defaultValue={client?.preferred_language ?? ""}>
            <option value="">—</option>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </Select>
        </Field>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-2">
        <h2 className="text-[15px] font-medium md:col-span-2">{tc.requirements}</h2>
        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-[13px] font-medium text-soft">{tc.services}</legend>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <label key={s} className="cursor-pointer">
                <input type="checkbox" name="services" value={s} defaultChecked={client?.services.includes(s)} className="peer sr-only" />
                <span className="inline-block rounded-full px-3 py-1.5 text-[13px] text-soft ring-1 ring-inset ring-line-strong transition-colors peer-checked:bg-lime peer-checked:text-black peer-checked:ring-lime peer-focus-visible:outline-2 peer-focus-visible:outline-lime">
                  {t.service[s]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={tc.budget}><Input name="budget_range" defaultValue={client?.budget_range ?? ""} /></Field>
        <Field label={tc.timeline}><Input name="timeline" defaultValue={client?.timeline ?? ""} /></Field>
        <Field label={tc.requirements} className="md:col-span-2">
          <Textarea name="requirements" rows={4} defaultValue={client?.requirements ?? ""} />
        </Field>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-3">
        <h2 className="text-[15px] font-medium md:col-span-3">{t.nav.pipeline}</h2>
        <Field label={tc.status}>
          <Select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
          </Select>
        </Field>
        <Field label={tc.priority}>
          <Select name="priority" defaultValue={client?.priority ?? "medium"}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{t.priority[p]}</option>)}
          </Select>
        </Field>
        <Field label={tc.owner}>
          <Select name="owner_id" defaultValue={client ? (client.owner_id ?? "") : currentUserId}>
            <option value="">{t.common.unassigned}</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label={tc.dealValue}><Input name="deal_value" inputMode="decimal" dir="ltr" defaultValue={client?.deal_value ?? ""} /></Field>
        <Field label={tc.score} hint="0–100"><Input name="lead_score" type="number" min={0} max={100} dir="ltr" defaultValue={client?.lead_score ?? ""} /></Field>
        <Field label={tc.followUp}>
          <Input name="next_follow_up_at" type="datetime-local" defaultValue={client?.next_follow_up_at ? utcToZonedInput(client.next_follow_up_at) : ""} />
        </Field>
        {status === "lost" && (
          <Field label={tc.lostReason} className="md:col-span-3"><Input name="lost_reason" defaultValue={client?.lost_reason ?? ""} /></Field>
        )}
        <Field label={tc.tags} hint={tc.tagsHint} className="md:col-span-3"><Input name="tags" defaultValue={client?.tags.join(", ") ?? ""} /></Field>
      </Card>

      <Card className="grid gap-4 p-5 md:grid-cols-4">
        <h2 className="text-[15px] font-medium md:col-span-4">{tc.marketing}</h2>
        <Field label={tc.source}>
          <Select name="source" defaultValue={client?.source ?? "manual"}>
            {SOURCES.map((s) => <option key={s} value={s}>{t.source[s]}</option>)}
          </Select>
        </Field>
        <Field label={tc.utmCampaign}><Input name="utm_campaign" dir="ltr" defaultValue={client?.utm_campaign ?? ""} /></Field>
        <Field label={tc.utmSource}><Input name="utm_source" dir="ltr" defaultValue={client?.utm_source ?? ""} /></Field>
        <Field label={tc.utmMedium}><Input name="utm_medium" dir="ltr" defaultValue={client?.utm_medium ?? ""} /></Field>
      </Card>

      <div className="sticky bottom-20 z-10 flex justify-end gap-2 rounded-full bg-canvas/80 py-2 backdrop-blur lg:bottom-4">
        <LinkButton href={cancelHref} variant="secondary">{t.common.cancel}</LinkButton>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? t.common.loading : client ? t.common.saveChanges : t.clients.new}
        </Button>
      </div>
    </form>
  );
}
