"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteMeeting, saveMeeting } from "@/lib/actions/crm";
import { MEETING_STATUSES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { MeetingRow } from "@/lib/queries";
import { utcToZonedInput } from "@/lib/utils";
import { Dialog } from "@/components/dialog";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ClientPicker, type PickedClient } from "./client-picker";

export type MeetingDraft = Partial<MeetingRow> & { startLocal?: string };

function plusHour(local: string) {
  const [d, time = "10:00"] = local.split("T");
  const [h, m] = time.split(":").map(Number);
  const date = new Date(`${d}T00:00:00Z`);
  date.setUTCMinutes(h * 60 + m + 60);
  return date.toISOString().slice(0, 16);
}

export function MeetingDialog({
  draft,
  onClose,
  team,
  currentUserId,
}: {
  draft: MeetingDraft | null;
  onClose: () => void;
  team: { id: string; name: string }[];
  currentUserId: string;
}) {
  const { t } = useI18n();
  const tc = t.calendar;
  const router = useRouter();
  const [state, action, pending] = useActionState(saveMeeting, null);
  const [client, setClient] = useState<PickedClient>(null);
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");

  useEffect(() => {
    if (!draft) return;
    setClient(draft.client_id ? { id: draft.client_id, label: draft.client_name ?? "" } : null);
    const s = draft.starts_at ? utcToZonedInput(draft.starts_at) : (draft.startLocal ?? utcToZonedInput(new Date()).slice(0, 11) + "10:00");
    setStarts(s);
    setEnds(draft.ends_at ? utcToZonedInput(draft.ends_at) : plusHour(s));
  }, [draft]);

  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const editing = Boolean(draft?.id);

  return (
    <Dialog open={Boolean(draft)} onClose={onClose} title={editing ? tc.editMeeting : tc.newMeeting}>
      {draft && (
        <form
          key={draft.id ?? draft.startLocal ?? "new"}
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => action(fd));
          }}
        >
          {draft.id && <input type="hidden" name="id" value={draft.id} />}
          <Field label={tc.meetingTitle}>
            <Input name="title" required defaultValue={draft.title ?? ""} autoFocus />
          </Field>
          <Field label={tc.client}>
            <ClientPicker name="client_id" value={client} onChange={setClient} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tc.starts}>
              <Input
                name="starts_at"
                type="datetime-local"
                required
                value={starts}
                onChange={(e) => {
                  const v = e.target.value;
                  if (ends && starts && v) {
                    // keep duration when moving the start
                    const dur = new Date(ends + "Z").getTime() - new Date(starts + "Z").getTime();
                    setEnds(new Date(new Date(v + "Z").getTime() + Math.max(dur, 15 * 60_000)).toISOString().slice(0, 16));
                  }
                  setStarts(v);
                }}
              />
            </Field>
            <Field label={tc.ends}>
              <Input name="ends_at" type="datetime-local" required value={ends} min={starts} onChange={(e) => setEnds(e.target.value)} />
            </Field>
          </div>
          <Field label={tc.location} hint={tc.locationHint}>
            <Input name="location" defaultValue={draft.location ?? ""} />
          </Field>
          <Field label={tc.meetingUrl}>
            <Input name="meeting_url" type="url" dir="ltr" placeholder="https://meet.google.com/…" defaultValue={draft.meeting_url ?? ""} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tc.owner}>
              <Select name="owner_id" defaultValue={draft.owner_id ?? currentUserId}>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label={tc.status}>
              <Select name="status" defaultValue={draft.status ?? "scheduled"}>
                {MEETING_STATUSES.map((s) => <option key={s} value={s}>{tc[s]}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={tc.description}>
            <Textarea name="description" rows={3} defaultValue={draft.description ?? ""} />
          </Field>
          {state?.error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {state.error === "range" ? tc.invalidRange : t.errors.required}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            {editing && (
              <Button
                type="button"
                variant="danger"
                size="icon"
                aria-label={t.common.delete}
                onClick={() => {
                  if (!draft.id || !confirm(t.common.confirmDelete)) return;
                  startTransition(async () => {
                    await deleteMeeting(draft.id!);
                    onClose();
                    router.refresh();
                  });
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button type="button" variant="secondary" className="ms-auto" onClick={onClose}>{t.common.cancel}</Button>
            <Button type="submit" disabled={pending}>{pending ? t.common.loading : t.common.save}</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
