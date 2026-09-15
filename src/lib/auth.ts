import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "./session";
import type { Role } from "./constants";
import type { Locale } from "./i18n/dictionaries";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  locale: Locale;
  calendar_token: string;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const sql = db();
  const [user] = await sql<CurrentUser[]>`
    select id, name, email, role, locale, calendar_token
    from users where id = ${session.uid} and is_active = true`;
  return user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function can(user: Pick<CurrentUser, "role">, action: "delete" | "manageKeys" | "manageTeam") {
  if (action === "manageTeam") return user.role === "admin";
  return user.role === "admin" || user.role === "manager";
}

export async function startSession(userId: string, role: string) {
  const token = await signSession({ uid: userId, role });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
