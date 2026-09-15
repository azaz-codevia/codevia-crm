"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { addMember, resetMemberPassword, updateMember } from "@/lib/actions/settings";
import { ROLES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { TeamMember } from "@/lib/queries";
import { cn, relativeTime } from "@/lib/utils";
import { Avatar, Badge, Button, Card, CardTitle, Field, Input, Select } from "@/components/ui";
import { CopyField } from "@/components/copy-field";
import { SubmitButton } from "@/components/submit-button";

export function TeamPanel({ members, currentUserId }: { members: TeamMember[]; currentUserId: string }) {
  const { t, locale } = useI18n();
  const ts = t.settings;
  const router = useRouter();
  const [state, action] = useActionState(addMember, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ error?: string; secret?: string; who?: string } | null>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const errorText = (code?: string) =>
    code === "lastAdmin" ? ts.lastAdmin : code === "emailTaken" ? ts.emailTaken : code === "forbidden" ? ts.adminOnly : code ? t.common.error : undefined;

  const run = (fn: () => Promise<{ error?: string; secret?: string } | null>, who?: string) =>
    start(async () => {
      const res = await fn();
      setNotice(res?.error ? { error: res.error } : res?.secret ? { secret: res.secret, who } : null);
      router.refresh();
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
      <Card className="self-start">
        <CardTitle>{ts.addMember}</CardTitle>
        <form ref={formRef} action={action} className="flex flex-col gap-3 px-5 pb-5">
          <Field label={ts.name}>
            <Input name="name" required />
          </Field>
          <Field label={t.auth.email}>
            <Input name="email" type="email" required dir="ltr" />
          </Field>
          <Field label={ts.role}>
            <Select name="role" defaultValue="agent">
              {ROLES.map((r) => <option key={r} value={r}>{t.role[r]}</option>)}
            </Select>
          </Field>
          {state?.error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{errorText(state.error)}</p>}
          {state?.secret && (
            <div className="rounded-2xl bg-lime/10 p-3 ring-1 ring-inset ring-lime/30">
              <p className="mb-2 text-sm text-lime">{ts.memberAdded}</p>
              <p dir="ltr" className="mb-1.5 text-start text-xs text-muted">{state.message}</p>
              <CopyField value={state.secret} secret />
            </div>
          )}
          <SubmitButton className="self-start" pendingLabel={t.common.loading}>
            <UserPlus className="h-4 w-4" aria-hidden /> {ts.addMember}
          </SubmitButton>
        </form>
      </Card>

      <Card>
        <CardTitle>{ts.team}</CardTitle>
        {notice?.error && <p role="alert" className="mx-5 mb-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{errorText(notice.error)}</p>}
        {notice?.secret && (
          <div className="mx-5 mb-3 rounded-2xl bg-lime/10 p-3 ring-1 ring-inset ring-lime/30">
            <p className="mb-2 text-sm text-lime">{ts.tempPassword} · {notice.who}</p>
            <CopyField value={notice.secret} secret />
          </div>
        )}
        <ul className="divide-y divide-line px-5 pb-3">
          {members.map((m) => (
            <li key={m.id} className={cn("flex flex-wrap items-center gap-3 py-3", !m.is_active && "opacity-55")}>
              <Avatar name={m.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.name} {m.id === currentUserId && <span className="text-xs text-muted">({t.common.you})</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  <span dir="ltr">{m.email}</span>
                  {m.last_login_at && ` · ${relativeTime(m.last_login_at, locale)}`}
                </p>
              </div>
              {!m.is_active && <Badge tone="tone-lost">{ts.deactivate}</Badge>}
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <Select
                  aria-label={ts.role}
                  className="h-8 w-auto flex-1 text-[13px] sm:flex-none"
                  value={m.role}
                  disabled={pending}
                  onChange={(e) => run(() => updateMember(m.id, { role: e.target.value }))}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{t.role[r]}</option>)}
                </Select>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm(`${ts.resetPassword}?`) && run(() => resetMemberPassword(m.id), m.email)}>
                  {ts.resetPassword}
                </Button>
                {m.id !== currentUserId && (
                  <Button size="sm" variant={m.is_active ? "danger" : "secondary"} disabled={pending} onClick={() => run(() => updateMember(m.id, { is_active: !m.is_active }))}>
                    {m.is_active ? ts.deactivate : ts.activate}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
