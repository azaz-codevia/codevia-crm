import { requireUser } from "@/lib/auth";
import { Sidebar, MobileTabBar } from "@/components/shell/nav";
import { Topbar } from "@/components/shell/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <Sidebar user={{ name: user.name, role: user.role }} />
      <div className="flex min-w-0 flex-col">
        <Topbar user={{ name: user.name, email: user.email }} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
