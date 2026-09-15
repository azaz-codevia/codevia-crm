import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { getTeam } from "@/lib/queries";
import { formatDateTime } from "@/lib/utils";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { ImportWizard } from "@/components/import/import-wizard";

export const metadata = { title: "Import" };
// Each chunk runs as a Server Action on this route
export const maxDuration = 60;

type Batch = { id: string; file_name: string | null; total: number; created: number; updated: number; skipped: number; failed: number; created_at: Date; user_name: string | null };

export default async function ImportPage() {
  const user = await requireUser();
  const { t, locale } = await getI18n();
  const sql = db();
  const [team, batches] = await Promise.all([
    getTeam(),
    sql<Batch[]>`
      select b.*, u.name as user_name from import_batches b left join users u on u.id = b.user_id
      order by b.created_at desc limit 8`,
  ]);

  return (
    <div>
      <PageHeader title={t.import.title} subtitle={t.import.subtitle} />
      <ImportWizard team={team.map((m) => ({ id: m.id, name: m.name }))} currentUserId={user.id} />
      {batches.length > 0 && (
        <Card className="mt-6">
          <CardTitle>{t.import.history}</CardTitle>
          <ul className="divide-y divide-line px-5 pb-3">
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.file_name ?? "—"}</p>
                  <p className="text-xs text-muted">
                    <span className="num">{formatDateTime(b.created_at, locale)}</span>
                    {b.user_name && ` · ${b.user_name}`}
                  </p>
                </div>
                <p className="flex flex-wrap gap-x-3 text-xs">
                  <span className="text-lime">{fmt(t.import.createdN, { count: b.created })}</span>
                  <span className="text-info">{fmt(t.import.updatedN, { count: b.updated })}</span>
                  <span className="text-muted">{fmt(t.import.skippedN, { count: b.skipped })}</span>
                  {b.failed > 0 && <span className="text-danger">{fmt(t.import.failedN, { count: b.failed })}</span>}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
