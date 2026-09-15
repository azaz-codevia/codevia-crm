"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { changePassword, updateProfile } from "@/lib/actions/settings";
import { useI18n } from "@/lib/i18n/client";
import { Card, CardTitle, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>;
  if (ok) return <p role="status" className="rounded-xl bg-lime/10 px-3 py-2 text-sm text-lime">{ok}</p>;
  return null;
}

export function ProfilePanel({ name, email, role }: { name: string; email: string; role: string }) {
  const { t, locale } = useI18n();
  const ts = t.settings;
  const router = useRouter();
  const [profileState, profileAction] = useActionState(updateProfile, null);
  const [pwState, pwAction] = useActionState(changePassword, null);
  const pwForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (profileState?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileState]);
  useEffect(() => {
    if (pwState?.ok) pwForm.current?.reset();
  }, [pwState]);

  const pwError = pwState?.error === "wrong" ? ts.wrongPassword : pwState?.error === "password" ? t.auth.passwordHint : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>{ts.profile}</CardTitle>
        <form action={profileAction} className="flex flex-col gap-4 px-5 pb-5">
          <Field label={ts.name}>
            <Input name="name" required defaultValue={name} />
          </Field>
          <Field label={t.auth.email} hint={t.role[role as keyof typeof t.role]}>
            <Input value={email} readOnly disabled dir="ltr" />
          </Field>
          <Field label={ts.language}>
            <Select name="locale" defaultValue={locale}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </Select>
          </Field>
          <Notice ok={profileState?.ok ? t.common.saved : undefined} error={profileState?.error ? t.errors.required : undefined} />
          <SubmitButton className="self-start" pendingLabel={t.common.loading}>{t.common.saveChanges}</SubmitButton>
        </form>
      </Card>

      <Card>
        <CardTitle>{ts.changePassword}</CardTitle>
        <form ref={pwForm} action={pwAction} className="flex flex-col gap-4 px-5 pb-5">
          <Field label={ts.currentPassword}>
            <Input name="current" type="password" required autoComplete="current-password" />
          </Field>
          <Field label={ts.newPassword} hint={t.auth.passwordHint}>
            <Input name="next" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Notice ok={pwState?.ok ? ts.passwordChanged : undefined} error={pwError} />
          <SubmitButton className="self-start" variant="secondary" pendingLabel={t.common.loading}>{ts.changePassword}</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
