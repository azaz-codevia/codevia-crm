import Link from "next/link";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Setup" };

export default async function SetupPage() {
  const { t } = await getI18n();
  const [{ count }] = await db()<{ count: number }[]>`select count(*)::int as count from users`;
  if (count > 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-soft">{t.auth.setupDone}</p>
        <Link prefetch={false} href="/login" className="text-lime underline underline-offset-4">{t.auth.signIn}</Link>
      </div>
    );
  }
  return <SetupForm />;
}
