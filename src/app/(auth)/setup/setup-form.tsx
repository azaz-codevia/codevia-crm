"use client";

import { useActionState } from "react";
import { setupFirstAdmin } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useI18n } from "@/lib/i18n/client";

export function SetupForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(setupFirstAdmin, null);
  const error =
    state?.error === "password" ? t.auth.passwordHint : state?.error === "done" ? t.auth.setupDone : state?.error ? t.errors.required : null;
  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.auth.setupTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.auth.setupBody}</p>
      </div>
      <Field label={t.auth.name}>
        <Input name="name" required autoComplete="name" />
      </Field>
      <Field label={t.auth.email}>
        <Input name="email" type="email" required autoComplete="email" dir="ltr" />
      </Field>
      <Field label={t.auth.password} hint={t.auth.passwordHint}>
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" dir="ltr" />
      </Field>
      {error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <SubmitButton className="w-full justify-center">{t.auth.createAdmin}</SubmitButton>
    </form>
  );
}
