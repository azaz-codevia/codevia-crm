import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-7xl font-semibold text-lime">404</p>
        <p className="mt-3 text-soft">{t.errors.notFound}</p>
        <Link prefetch={false} href="/dashboard" className="mt-6 inline-block rounded-full bg-lime px-5 py-2.5 font-medium text-black">
          {t.nav.dashboard}
        </Link>
      </div>
    </main>
  );
}
