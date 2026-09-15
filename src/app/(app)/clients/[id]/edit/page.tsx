import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getClient, getTeam } from "@/lib/queries";
import { updateClient } from "@/lib/actions/crm";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/clients/client-form";

export const metadata = { title: "Edit client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { t } = await getI18n();
  const [client, team] = await Promise.all([getClient(id), getTeam(true)]);
  if (!client) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t.clients.edit} subtitle={client.company_name ?? client.contact_name ?? undefined} />
      <ClientForm
        action={updateClient.bind(null, id)}
        client={client}
        team={team.filter((m) => m.is_active || m.id === client.owner_id).map((m) => ({ id: m.id, name: m.name }))}
        cancelHref={`/clients/${id}`}
        currentUserId={user.id}
      />
    </div>
  );
}
