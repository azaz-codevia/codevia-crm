import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getTeam } from "@/lib/queries";
import { createClient } from "@/lib/actions/crm";
import { PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/clients/client-form";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  const user = await requireUser();
  const { t } = await getI18n();
  const team = await getTeam();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t.clients.new} />
      <ClientForm action={createClient} team={team.map((m) => ({ id: m.id, name: m.name }))} cancelHref="/clients" currentUserId={user.id} />
    </div>
  );
}
