import { Logo, SlashLines } from "@/components/brand";
import { LanguageToggle } from "@/components/language-toggle";
import { getI18n } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <main className="relative grid min-h-dvh overflow-hidden lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-e border-line p-10 lg:flex">
        <SlashLines />
        <Logo className="relative" />
        <div className="relative animate-rise">
          <p className="max-w-md text-[2.6rem] leading-[1.1] font-semibold tracking-tight">{t.app.tagline}</p>
          <p className="mt-4 text-sm text-muted">codevia.sa</p>
        </div>
      </section>
      <section className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <LanguageToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </section>
    </main>
  );
}
