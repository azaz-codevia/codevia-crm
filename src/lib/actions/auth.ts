"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { endSession, getCurrentUser, startSession } from "@/lib/auth";
import { isLocale } from "@/lib/i18n/dictionaries";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import { str } from "@/lib/utils";

export type FormState = { error?: string; ok?: boolean; message?: string; duplicateId?: string; secret?: string } | null;

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = str(formData.get("email"))?.toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "invalid" };

  const sql = db();
  const [user] = await sql<{ id: string; role: string; password_hash: string; is_active: boolean; locale: string }[]>`
    select id, role, password_hash, is_active, locale from users where lower(email) = ${email}`;

  // Constant-ish time: always run a bcrypt compare
  const hash = user?.password_hash ?? "$2b$12$cAXus2BZmG35org7F7MQyOmv0myyRRyep/985SEkDC825xtajo7Lq";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) return { error: "invalid" };
  if (!user.is_active) return { error: "inactive" };

  await sql`update users set last_login_at = now() where id = ${user.id}`;
  await startSession(user.id, user.role);
  const store = await cookies();
  if (isLocale(user.locale)) store.set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(safeNext(str(formData.get("next"))));
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function setupFirstAdmin(_: FormState, formData: FormData): Promise<FormState> {
  const name = str(formData.get("name"));
  const email = str(formData.get("email"))?.toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) return { error: "required" };
  if (password.length < 8) return { error: "password" };

  const sql = db();
  const hash = await bcrypt.hash(password, 12);
  // Single atomic statement: only inserts while the users table is still empty.
  // (No explicit transaction or advisory lock — those can get stuck behind Supabase's transaction pooler.)
  const [created] = await sql<{ id: string }[]>`
    insert into users (name, email, password_hash, role)
    select ${name}, ${email}, ${hash}, 'admin'
    where not exists (select 1 from users)
    returning id`;
  if (!created) return { error: "done" };
  await startSession(created.id, "admin");
  redirect("/dashboard");
}

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) {
    await db()`update users set locale = ${locale} where id = ${user.id}`;
  }
  revalidatePath("/", "layout");
}
