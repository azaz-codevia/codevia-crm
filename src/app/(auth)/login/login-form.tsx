"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useI18n } from "@/lib/i18n/client";

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t.auth.welcome}</h1>
      <input type="hidden" name="next" value={next} />
      <Field label={t.auth.email}>
        <Input name="email" type="email" autoComplete="email" required dir="ltr" />
      </Field>
      <Field label={t.auth.password}>
        <Input name="password" type="password" autoComplete="current-password" required dir="ltr" />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error === "inactive" ? t.auth.inactive : t.auth.invalid}
        </p>
      )}
      <SubmitButton className="mt-1 w-full justify-center" pendingLabel={t.auth.signingIn}>
        {t.auth.signIn}
      </SubmitButton>
    </form>
  );
}
