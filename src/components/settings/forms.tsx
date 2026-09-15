"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Plus, Power, RotateCcw } from "lucide-react";
import type { FormState } from "@/lib/actions/auth";
import { addMember, changePassword, createApiKey, resetMemberPassword, revokeApiKey, updateMember, updateProfile } from "@/lib/actions/settings";
import { LOCALES, type Dictionary } from "@/lib/i18n/dictionaries";
import { ROLES, SOURCES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Button, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CopyField } from "@/components/copy-field";

function errorText(t: Dictionary, code?: string) {
  switch (code) {
    case "password":
      return t.auth.passwordHint;
    case "wrong":
      return t.settings.wrongPassword;
    case "emailTaken":
      return t.settings.emailTaken;
    case "lastAdmin":
      return t.settings.lastAdmin;
    case "forbidden":
      return t.errors.forbidden;
    case "required":
      return t.errors.required;
    case "notFound":
      return t.errors.notFound;
    default:
      return t.common.error;
  }
}

function Feedback({ state, okText }: { state: FormState; okText?: string }) {
  const { t } = useI18n();
  if (state?.error) return <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{errorText(t, state.error)}</p>;
  if (state?.ok && okText) return <p role="status" className="flex items-center gap-2 text-sm text-lime"><CheckCircle2 className="h-4 w-4" />{okText}</p>;
  return null;
}

export function ProfileForm({ name, email, locale }: { name: string; email: string; locale: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(updateProfile, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t.settings.name}>
        <Input name="name" required defaultValue={name} autoComplete="name" />
      </Field>
      <Field label={t.auth.email}>
        <Input value={email} disabled dir="ltr" className="opacity-70" />
      </Field>
      <Field label={t.settings.language}>
        <Select name="locale" defaultValue={locale}>
          {LOCALES.map((l) => <option key={l} value={l}>{l === "ar" ? "العربية" : "English"}</option>)}
        </Select>
      </Field>
      <Feedback state={state} okText={t.common.saved} />
      <div><SubmitButton pendingLabel={t.common.loading}>{t.common.saveChanges}</SubmitButton></div>
    </form>
  );
}

export function PasswordForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(changePassword, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      <Field label={t.settings.currentPassword}>
        <Input name="current" type="password" required autoComplete="current-password" />
      </Field>
      <Field label={t.settings.newPassword} hint={t.auth.passwordHint}>
        <Input name="next" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Feedback state={state} okText={t.settings.passwordChanged} />
      <div><SubmitButton variant="secondary" pendingLabel={t.common.loading}>{t.settings.changePassword}</SubmitButton></div>
    </form>
  );
}

export function CreateKeyForm() {
  const { t } = useI18n();
  const ts = t.settings;
  const [state, action] = useActionState(createApiKey, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <div className="flex flex-col gap-3">
      <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label={ts.keyName}>
          <Input name="name" required placeholder={ts.keyNamePlaceholder} dir="auto" />
        </Field>
        <Field label={ts.keySource}>
          <Select name="default_source" defaultValue="discovery">
            {SOURCES.filter((s) => s !== "excel_import" && s !== "manual").map((s) => <option key={s} value={s}>{t.source[s]}</option>)}
          </Select>
        </Field>
        <SubmitButton pendingLabel={t.common.loading}>
          <Plus className="h-4 w-4" aria-hidden /> {ts.createKey}
        </SubmitButton>
      </form>
      {state?.error && <Feedback state={state} />}
      {state?.ok && state.secret && (
        <div className="flex flex-col gap-2 rounded-2xl bg-lime/10 p-4 ring-1 ring-inset ring-lime/30">
          <p className="flex items-center gap-2 text-sm font-medium text-lime">
            <KeyRound className="h-4 w-4" aria-hidden /> {ts.keyCreated}
          </p>
          <CopyField value={state.secret} secret />
        </div>
      )}
    </div>
  );
}

export function RevokeKeyButton({ id }: { id: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (!confirm(t.common.confirmDelete)) return;
        start(async () => {
          await revokeApiKey(id);
          router.refresh();
        });
      }}
    >
      {t.settings.revoke}
    </Button>
  );
}

export function AddMemberForm() {
  const { t } = useI18n();
  const ts = t.settings;
  const [state, action] = useActionState(addMember, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <div className="flex flex-col gap-3">
      <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_0.8fr_auto] lg:items-end">
        <Field label={t.auth.name}>
          <Input name="name" required autoComplete="off" />
        </Field>
        <Field label={t.auth.email}>
          <Input name="email" type="email" required dir="ltr" autoComplete="off" />
        </Field>
        <Field label={ts.role}>
          <Select name="role" defaultValue="agent">
            {ROLES.map((r) => <option key={r} value={r}>{t.role[r]}</option>)}
          </Select>
        </Field>
        <SubmitButton pendingLabel={t.common.loading}>
          <Plus className="h-4 w-4" aria-hidden /> {ts.addMember}
        </SubmitButton>
      </form>
      {state?.error && <Feedback state={state} />}
      {state?.ok && state.secret && <SecretNotice title={ts.memberAdded} label={`${state.message} · ${ts.tempPassword}`} secret={state.secret} />}
    </div>
  );
}

function SecretNotice({ title, label, secret }: { title: string; label: string; secret: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-lime/10 p-4 ring-1 ring-inset ring-lime/30">
      <p className="text-sm font-medium text-lime">{title}</p>
      <p className="text-xs text-soft" dir="auto">{label}</p>
      <CopyField value={secret} secret />
    </div>
  );
}

export function MemberControls({ id, role, isActive, isSelf }: { id: string; role: string; isActive: boolean; isSelf: boolean }) {
  const { t } = useI18n();
  const ts = t.settings;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FormState>(null);

  const run = (fn: () => Promise<FormState>) =>
    start(async () => {
      const res = await fn();
      setResult(res);
      router.refresh();
    });

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-60")}>
        <Select
          aria-label={ts.role}
          value={role}
          disabled={pending || isSelf}
          onChange={(e) => run(() => updateMember(id, { role: e.target.value }))}
          className="h-8 w-auto min-w-32 text-xs"
        >
          {ROLES.map((r) => <option key={r} value={r}>{t.role[r]}</option>)}
        </Select>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!confirm(`${ts.resetPassword}?`)) return;
            run(() => resetMemberPassword(id));
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">{ts.resetPassword}</span>
        </Button>
        {!isSelf && (
          <Button size="sm" variant={isActive ? "danger" : "secondary"} disabled={pending} onClick={() => run(() => updateMember(id, { is_active: !isActive }))}>
            <Power className="h-3.5 w-3.5" aria-hidden /> {isActive ? ts.deactivate : ts.activate}
          </Button>
        )}
      </div>
      {result?.error && <p className="text-xs text-danger">{errorText(t, result.error)}</p>}
      {result?.ok && result.secret && <SecretNotice title={ts.tempPassword} label={ts.memberAdded} secret={result.secret} />}
    </div>
  );
}
