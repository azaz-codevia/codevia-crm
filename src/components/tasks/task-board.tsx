"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, Flag, Plus, Trash2 } from "lucide-react";
import { createTask, deleteTask, toggleTask } from "@/lib/actions/crm";
import { PRIORITIES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { TaskRow } from "@/lib/queries";
import { cn, dayKey, formatDateTime, formatTime } from "@/lib/utils";
import { ClientPicker, type PickedClient } from "@/components/meetings/client-picker";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui";

type Props = {
  tasks: TaskRow[];
  team: { id: string; name: string }[];
  currentUserId: string;
  scope: "mine" | "all";
  showDone: boolean;
  today: string;
};

export function TaskBoard({ tasks, team, currentUserId, scope, showDone, today }: Props) {
  const { t, locale } = useI18n();
  const tt = t.tasks;
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  const [optimistic, toggleOptimistic] = useOptimistic(tasks, (list, id: string) =>
    list.map((task) => (task.id === id ? { ...task, completed_at: task.completed_at ? null : new Date() } : task)),
  );
  const [state, action, pending] = useActionState(createTask, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [client, setClient] = useState<PickedClient>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setClient(null);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const href = (patch: { scope?: string; done?: boolean }) => {
    const qs = new URLSearchParams();
    if ((patch.scope ?? scope) === "all") qs.set("scope", "all");
    if (patch.done ?? showDone) qs.set("done", "1");
    const s = qs.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const groups: { key: string; label: string; items: TaskRow[]; tone?: string }[] = [
    { key: "overdue", label: tt.overdue, items: [], tone: "text-danger" },
    { key: "today", label: tt.todayGroup, items: [], tone: "text-lime" },
    { key: "upcoming", label: tt.upcoming, items: [] },
    { key: "none", label: tt.noDate, items: [] },
    { key: "done", label: tt.done, items: [] },
  ];
  const now = Date.now();
  for (const task of optimistic) {
    if (task.completed_at) groups[4].items.push(task);
    else if (!task.due_at) groups[3].items.push(task);
    else if (new Date(task.due_at).getTime() < now) groups[0].items.push(task);
    else if (dayKey(task.due_at) === today) groups[1].items.push(task);
    else groups[2].items.push(task);
  }
  if (!showDone) groups[4].items = [];
  const openCount = optimistic.filter((x) => !x.completed_at).length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-3 sm:p-4">
        <form ref={formRef} action={action} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input name="title" required placeholder={tt.placeholder} onFocus={() => setExpanded(true)} />
            <Button type="submit" size="icon" disabled={pending} aria-label={tt.new} className="h-10 w-10">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-4", !expanded && "hidden")}>
            <Input name="due_at" type="datetime-local" aria-label={tt.due} />
            <Select name="assignee_id" defaultValue={currentUserId} aria-label={tt.assignee}>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            <Select name="priority" defaultValue="medium" aria-label={t.clients.priority}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{t.clients.priority}: {t.priority[p]}</option>)}
            </Select>
            <ClientPicker name="client_id" value={client} onChange={setClient} />
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-panel p-1 ring-1 ring-inset ring-line">
          {(["mine", "all"] as const).map((s) => (
            <Link key={s} href={href({ scope: s })} className={cn("rounded-full px-3 py-1 text-sm", scope === s ? "bg-raised text-fg" : "text-muted hover:text-fg")}>
              {s === "mine" ? tt.mine : tt.everyone}
            </Link>
          ))}
        </div>
        <Link
          href={href({ done: !showDone })}
          className={cn("ms-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 ring-inset", showDone ? "text-fg ring-lime/50" : "text-muted ring-line")}
          aria-pressed={showDone}
        >
          <span className={cn("grid h-4 w-4 place-items-center rounded ring-1 ring-inset", showDone ? "bg-lime text-black ring-lime" : "ring-line-strong")}>
            {showDone && <Check className="h-3 w-3" />}
          </span>
          {tt.showDone}
        </Link>
      </div>

      {openCount === 0 && !groups[4].items.length ? (
        <Card>
          <EmptyState>{tt.empty}</EmptyState>
        </Card>
      ) : (
        groups
          .filter((g) => g.items.length)
          .map((g) => (
            <Card key={g.key}>
              <h2 className={cn("flex items-center gap-2 px-5 pt-4 pb-1 text-sm font-medium", g.tone ?? "text-soft")}>
                {g.label}
                <span className="num rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{g.items.length}</span>
              </h2>
              <ul className="divide-y divide-line px-3 pb-2 sm:px-5">
                {g.items.map((task) => (
                  <li key={task.id} className="group flex items-start gap-3 py-3">
                    <button
                      type="button"
                      aria-label={task.title}
                      aria-pressed={Boolean(task.completed_at)}
                      onClick={() =>
                        start(async () => {
                          toggleOptimistic(task.id);
                          await toggleTask(task.id);
                          router.refresh();
                        })
                      }
                      className={cn(
                        "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-colors",
                        task.completed_at ? "bg-lime text-black ring-lime" : "ring-line-strong hover:ring-lime",
                      )}
                    >
                      {task.completed_at && <Check className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm leading-snug", task.completed_at && "text-muted line-through")}>
                        {task.priority === "high" && !task.completed_at && <Flag className="me-1.5 inline h-3.5 w-3.5 text-danger" aria-label={t.priority.high} />}
                        {task.title}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        {task.due_at && (
                          <span className={cn("num", g.key === "overdue" && "text-danger")}>
                            {g.key === "today" ? formatTime(task.due_at, locale) : formatDateTime(task.due_at, locale)}
                          </span>
                        )}
                        {task.client_id && task.client_name && (
                          <Link href={`/clients/${task.client_id}`} className="truncate text-soft hover:text-lime">
                            {task.client_name}
                          </Link>
                        )}
                        {scope === "all" && task.assignee_name && <span>{task.assignee_name}</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t.common.delete}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted hover:text-danger md:opacity-0 md:group-hover:opacity-100"
                      onClick={() => {
                        if (!confirm(t.common.confirmDelete)) return;
                        start(async () => {
                          await deleteTask(task.id);
                          router.refresh();
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))
      )}
    </div>
  );
}
