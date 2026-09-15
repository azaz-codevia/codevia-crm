import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/dashboard");
  const [{ count }] = await db()<{ count: number }[]>`select count(*)::int as count from users`;
  if (count === 0) redirect("/setup");
  const { next } = await searchParams;
  return <LoginForm next={next ?? ""} />;
}
