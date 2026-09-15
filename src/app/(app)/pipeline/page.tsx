import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { getTeam } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { KanbanBoard, type KanbanCard } from "@/components/pipeline/kanban";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ owner?: string; closed?: string }> }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const { owner, closed } = await searchParams;
  const sql = db();
  const ownerId = owner === "me" ? user.id : owner && /^[0-9a-f-]{36}$/i.test(owner) ? owner : null;
  const showClosed = closed !== "0";

  const [cards, team] = await Promise.all([
    sql<KanbanCard[]>`
      select c.id, coalesce(c.company_name, c.contact_name, c.email, '—') as title,
             case when c.company_name is not null then c.contact_name end as subtitle,
             c.status, c.deal_value, c.lead_score, c.priority, u.name as owner_name, c.updated_at, c.next_follow_up_at
      from clients c left join users u on u.id = c.owner_id
      where true
        ${ownerId ? sql`and c.owner_id = ${ownerId}` : sql``}
        ${showClosed ? sql`and (c.status not in ('won','lost') or c.updated_at > now() - interval '60 days')` : sql`and c.status not in ('won','lost')`}
      order by c.priority = 'high' desc, c.deal_value desc nulls last, c.updated_at desc
      limit 1000`,
    getTeam(),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader title={t.pipeline.title} subtitle={t.pipeline.subtitle} />
      <KanbanBoard cards={cards} team={team.map((m) => ({ id: m.id, name: m.name }))} owner={owner ?? ""} />
    </div>
  );
}
