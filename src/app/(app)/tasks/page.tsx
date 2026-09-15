import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getTasks, getTeam } from "@/lib/queries";
import { dayKey } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { TaskBoard } from "@/components/tasks/task-board";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ scope?: string; done?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const sp = await searchParams;
  const scope = sp.scope === "all" ? "all" : "mine";
  const showDone = sp.done === "1";

  const [tasks, team] = await Promise.all([
    getTasks({ assigneeId: scope === "mine" ? user.id : undefined, includeDone: showDone }),
    getTeam(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.tasks.title} />
      <TaskBoard
        tasks={tasks}
        team={team.map((m) => ({ id: m.id, name: m.name }))}
        currentUserId={user.id}
        scope={scope}
        showDone={showDone}
        today={dayKey(new Date())}
      />
    </div>
  );
}
