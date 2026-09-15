"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { CalendarPlus, Check, Pin, PinOff, Trash2, Video } from "lucide-react";
import { addNote, createTask, deleteClientAndRedirect, deleteNote, deleteTask, markContacted, setClientStatus, toggleNotePin, toggleTask } from "@/lib/actions/crm";
import { STATUS_TONE, STATUSES, type Status } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { MeetingRow, NoteRow, TaskRow } from "@/lib/queries";
import { cn, formatDate, formatDateTime, formatTime, relativeTime } from "@/lib/utils";
import { Avatar, Badge, Button, Card, CardTitle, EmptyState, Input, Select, Textarea } from "@/components/ui";
import { MeetingDialog, type MeetingDraft } from "@/components/meetings/meeting-dialog";

export function StatusSwitcher({ clientId, status }: { clientId: string; status: Status }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={cn(STATUS_TONE[status], "relative")}>
      <Select
        aria-label={t.clients.status}
        value={status}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setClientStatus([clientId], e.target.value);
            router.refresh();
          })
        }
        className="badge-tone h-9 w-auto rounded-full ps-4 pe-9 font-medium ring-0"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
      </Select>
    </div>
  );
}

export function ContactedButton({ clientId }: { clientId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markContacted(clientId);
          router.refresh();
        })
      }
    >
      <Check className="h-4 w-4" aria-hidden /> {t.clients.markContacted}
    </Button>
  );
}

export function DeleteClientButton({ clientId }: { clientId: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size="icon"
      aria-label={t.clients.deleteClient}
      title={t.clients.deleteClient}
      disabled={pending}
      onClick={() => confirm(t.common.confirmDelete) && start(async () => void (await deleteClientAndRedirect(clientId)))}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function NotesPanel({ clientId, notes, currentUserId, canDeleteAny }: { clientId: string; notes: NoteRow[]; currentUserId: string; canDeleteAny: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(addNote.bind(null, clientId), null);
  const formRef = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardTitle>{t.clients.notes}</CardTitle>
      <form ref={formRef} action={action} className="px-5 pb-4">
        <Textarea
          name="body"
          required
          rows={3}
          placeholder={t.clients.notePlaceholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" size="sm" disabled={pending}>{t.clients.addNote}</Button>
        </div>
      </form>
      {notes.length === 0 ? (
        <EmptyState>{t.clients.noNotes}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2 px-3 pb-3">
          {notes.map((n) => (
            <li key={n.id} className={cn("group rounded-2xl p-3", n.is_pinned ? "bg-lime/[0.07] ring-1 ring-inset ring-lime/25" : "bg-raised/60")}>
              <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
                <Avatar name={n.author_name} className="h-5 w-5 text-[8px]" />
                <span className="text-soft">{n.author_name ?? t.activity.system}</span>
                <span title={formatDateTime(n.created_at, locale)}>{relativeTime(n.created_at, locale)}</span>
                <div className="ms-auto flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                  <button
                    type="button"
                    className="grid h-7 w-7 place-items-center rounded-full hover:bg-panel hover:text-lime"
                    aria-label={n.is_pinned ? t.clients.unpin : t.clients.pin}
                    onClick={() => start(async () => { await toggleNotePin(n.id, clientId); router.refresh(); })}
                  >
                    {n.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  {(canDeleteAny || n.author_id === currentUserId) && (
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-full hover:bg-panel hover:text-danger"
                      aria-label={t.common.delete}
                      onClick={() => confirm(t.common.confirmDelete) && start(async () => { await deleteNote(n.id, clientId); router.refresh(); })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg" dir="auto">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TasksPanel({ clientId, tasks, team, currentUserId }: { clientId: string; tasks: TaskRow[]; team: { id: string; name: string }[]; currentUserId: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [state, action, pending] = useActionState(createTask, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardTitle>{t.clients.tasks}</CardTitle>
      <form ref={formRef} action={action} className="grid gap-2 px-5 pb-4 sm:grid-cols-[1fr_auto]">
        <input type="hidden" name="client_id" value={clientId} />
        <Input name="title" required placeholder={t.tasks.placeholder} className="sm:col-span-2" />
        <div className="grid grid-cols-2 gap-2">
          <Input name="due_at" type="datetime-local" aria-label={t.tasks.due} />
          <Select name="assignee_id" defaultValue={currentUserId} aria-label={t.tasks.assignee}>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </div>
        <Button type="submit" size="md" variant="secondary" disabled={pending}>{t.tasks.new}</Button>
      </form>
      {tasks.length > 0 && (
        <ul className="divide-y divide-line px-5 pb-3">
          {tasks.map((task) => {
            const overdue = !task.completed_at && task.due_at && new Date(task.due_at) < new Date();
            return (
              <li key={task.id} className="group flex items-start gap-3 py-2.5">
                <button
                  type="button"
                  aria-label={task.title}
                  aria-pressed={Boolean(task.completed_at)}
                  onClick={() => start(async () => { await toggleTask(task.id); router.refresh(); })}
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md ring-1 ring-inset",
                    task.completed_at ? "bg-lime text-black ring-lime" : "ring-line-strong hover:ring-lime",
                  )}
                >
                  {task.completed_at && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", task.completed_at && "text-muted line-through")}>{task.title}</p>
                  <p className={cn("text-xs", overdue ? "text-danger" : "text-muted")}>
                    {task.due_at ? formatDateTime(task.due_at, locale) : t.tasks.noDate}
                    {task.assignee_name && ` · ${task.assignee_name}`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t.common.delete}
                  className="grid h-7 w-7 place-items-center rounded-full text-muted opacity-100 hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                  onClick={() => start(async () => { await deleteTask(task.id); router.refresh(); })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function MeetingsPanel({
  client,
  meetings,
  team,
  currentUserId,
}: {
  client: { id: string; label: string };
  meetings: MeetingRow[];
  team: { id: string; name: string }[];
  currentUserId: string;
}) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<MeetingDraft | null>(null);
  const openNew = () => setDraft({ client_id: client.id, client_name: client.label, title: `${t.calendar.newMeeting} — ${client.label}` });

  return (
    <Card>
      <CardTitle
        action={
          <Button size="sm" variant="secondary" onClick={openNew}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> {t.clients.scheduleMeeting}
          </Button>
        }
      >
        {t.clients.meetings}
      </CardTitle>
      {meetings.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">{t.calendar.noMeetings}</p>
      ) : (
        <ul className="divide-y divide-line px-5 pb-3">
          {meetings.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => setDraft(m)} className="flex w-full items-center gap-3 py-2.5 text-start hover:text-lime">
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", m.status === "cancelled" && "line-through text-muted")}>{m.title}</p>
                  <p className="text-xs text-muted">
                    {formatDate(m.starts_at, locale, { weekday: "short" })} · <span className="num">{formatTime(m.starts_at, locale)}</span>
                    {m.owner_name && ` · ${m.owner_name}`}
                  </p>
                </div>
                {m.meeting_url && <Video className="h-4 w-4 text-muted" aria-hidden />}
                <Badge>{t.calendar[m.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <MeetingDialog draft={draft} onClose={() => setDraft(null)} team={team} currentUserId={currentUserId} />
    </Card>
  );
}

