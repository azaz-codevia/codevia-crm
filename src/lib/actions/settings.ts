"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { generateApiKey, generateTempPassword } from "@/lib/api-keys";
import { isRole, isSource } from "@/lib/constants";
import { isLocale } from "@/lib/i18n/dictionaries";
import { LOCALE_COOKIE } from "@/lib/i18n/server";
import { str } from "@/lib/utils";
import type { FormState } from "./auth";

const UUID = /^[0-9a-f-]{36}$/i;

// ── Profile ─────────────────────────────────────────────────────────────

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = str(fd.get("name"));
  const locale = str(fd.get("locale"));
  if (!name) return { error: "required" };
  const nextLocale = isLocale(locale) ? locale : user.locale;
  await db()`update users set name = ${name.slice(0, 200)}, locale = ${nextLocale} where id = ${user.id}`;
  const store = await cookies();
  store.set(LOCALE_COOKIE, nextLocale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 8) return { error: "password" };
  const sql = db();
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${user.id}`;
  if (!row || !(await bcrypt.compare(current, row.password_hash))) return { error: "wrong" };
  await sql`update users set password_hash = ${await bcrypt.hash(next, 12)} where id = ${user.id}`;
  return { ok: true };
}

export async function resetCalendarToken() {
  const user = await requireUser();
  await db()`update users set calendar_token = encode(gen_random_bytes(24), 'hex') where id = ${user.id}`;
  revalidatePath("/calendar");
  revalidatePath("/settings");
}

// ── API keys (lead connector) ──────────────────────────────────────────

export async function createApiKey(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "manageKeys")) return { error: "forbidden" };
  const name = str(fd.get("name"));
  const source = str(fd.get("default_source"));
  if (!name) return { error: "required" };
  const { key, prefix, hash } = generateApiKey();
  await db()`insert into api_keys (name, key_prefix, key_hash, default_source, created_by)
    values (${name.slice(0, 120)}, ${prefix}, ${hash}, ${isSource(source) ? source : "discovery"}, ${user.id})`;
  revalidatePath("/settings");
  return { ok: true, secret: key };
}

export async function revokeApiKey(id: string) {
  const user = await requireUser();
  if (!can(user, "manageKeys") || !UUID.test(id)) return;
  await db()`update api_keys set revoked_at = now() where id = ${id} and revoked_at is null`;
  revalidatePath("/settings");
}

// ── Team ────────────────────────────────────────────────────────────────

export async function addMember(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "manageTeam")) return { error: "forbidden" };
  const name = str(fd.get("name"));
  const email = str(fd.get("email"))?.toLowerCase();
  const role = str(fd.get("role"));
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) return { error: "required" };
  const sql = db();
  const [exists] = await sql`select 1 from users where lower(email) = ${email}`;
  if (exists) return { error: "emailTaken" };
  const temp = generateTempPassword();
  await sql`insert into users (name, email, password_hash, role)
    values (${name.slice(0, 200)}, ${email}, ${await bcrypt.hash(temp, 12)}, ${isRole(role) ? role : "agent"})`;
  revalidatePath("/settings");
  return { ok: true, secret: temp, message: email };
}

async function wouldRemoveLastAdmin(id: string) {
  const [{ admins }] = await db()<{ admins: number }[]>`
    select count(*)::int as admins from users where role = 'admin' and is_active = true and id <> ${id}`;
  return admins === 0;
}

export async function updateMember(id: string, patch: { role?: string; is_active?: boolean }): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "manageTeam")) return { error: "forbidden" };
  if (!UUID.test(id)) return { error: "notFound" };
  const sql = db();
  const [target] = await sql<{ role: string; is_active: boolean }[]>`select role, is_active from users where id = ${id}`;
  if (!target) return { error: "notFound" };

  const demoting = patch.role !== undefined && patch.role !== "admin" && target.role === "admin";
  const disabling = patch.is_active === false && target.role === "admin";
  if ((demoting || disabling) && (await wouldRemoveLastAdmin(id))) return { error: "lastAdmin" };

  if (patch.role !== undefined && isRole(patch.role)) await sql`update users set role = ${patch.role} where id = ${id}`;
  if (patch.is_active !== undefined) await sql`update users set is_active = ${patch.is_active} where id = ${id}`;
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetMemberPassword(id: string): Promise<FormState> {
  const user = await requireUser();
  if (!can(user, "manageTeam")) return { error: "forbidden" };
  if (!UUID.test(id)) return { error: "notFound" };
  const temp = generateTempPassword();
  await db()`update users set password_hash = ${await bcrypt.hash(temp, 12)} where id = ${id}`;
  return { ok: true, secret: temp };
}
