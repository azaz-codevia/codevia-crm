# Codevia CRM

Bilingual (English / العربية with full RTL) CRM for **codevia.sa** — leads from the discovery form, Excel imports, pipeline, client notes, meetings with an iPhone-subscribable calendar, tasks and a stats dashboard.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · Tailwind CSS 4 · Supabase Postgres (raw SQL via `postgres`) · deploys to Vercel as-is.

---

## What's inside

| Module | What it does |
|---|---|
| **Dashboard** | Open pipeline value, new leads vs previous period, won revenue, win rate, meetings this week, overdue tasks, unassigned leads, avg lead score · leads-over-time chart · pipeline by stage · leads by source, service and campaign · team leaderboard · upcoming meetings, due tasks, latest leads. Range: 30 d / 90 d / 12 m / all. |
| **Clients** | Search + filters (status, source, owner, service, priority, campaign), sorting, bulk status / assign / delete, CSV export, duplicate detection on email and phone (Saudi `05…`, `+966…`, Arabic digits all normalised). Detail page: one-tap call / WhatsApp / email, status switcher, **team notes with pinning**, tasks, meetings, discovery-form answers, marketing attribution, full activity timeline. |
| **Pipeline** | Kanban across 8 stages with drag-and-drop (desktop) and stage tabs (mobile), stage totals. |
| **Calendar** | Month grid + agenda, click a day to book, meetings linked to clients (booking one moves the client to "Meeting set"). **Subscribe on iPhone** — all team meetings or only yours, auto-refresh every 15 min, 30-min alert, resettable private link. Works with Google Calendar and Outlook too. |
| **Tasks** | Overdue / Today / Upcoming / No date, mine vs everyone, priorities, linked to clients. |
| **Import** | Excel `.xlsx` or `.csv` → automatic column matching (English + Arabic headers) → review mapping → default status / source / owner → skip or fill duplicates → chunked import with progress. Unmapped columns are kept as discovery answers. Template download + import history. |
| **Lead connector** | `POST /api/webhooks/leads` with per-source API keys (create / revoke), JSON / form-encoded / multipart, Webflow / Zapier / Make envelopes, batch of up to 100, delivery log. Resubmissions update the existing client instead of duplicating. |
| **Settings** | Profile + language, password, calendar feed, API keys, team (admin): add member with temp password, change role, disable, reset password. |
| **Roles** | Admin (everything) · Manager (+ delete clients, API keys) · Sales agent. |
| **Mobile** | Bottom tab bar, bottom-sheet dialogs, card lists instead of tables, installable to the home screen (PWA manifest + icons). |

---

## 1. Create the database tables (once)

**Easiest:** Supabase Dashboard → **SQL Editor** → paste the whole of [`db/schema.sql`](db/schema.sql) → **Run**.

Or from your machine:

```bash
npm install
cp .env.example .env.local        # fill DIRECT_DATABASE_URL with your password
npm run db:migrate
```

> The direct host `db.<project>.supabase.co` is IPv6-only. If `db:migrate` can't connect, use the **Session pooler** URL from Supabase → Connect (same host as the transaction pooler, port **5432**) — or just use the SQL Editor.

The schema is idempotent, so running it again after an update is safe. Row-Level Security is switched on for every table so Supabase's public REST API can't read CRM data; the app connects as the database owner and isn't affected.

## 2. Deploy to Vercel

1. Push this folder to a GitHub repo and import it in Vercel (framework preset: **Next.js**, no build settings to change).
2. Add these **Environment Variables** (Production + Preview):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase → **Connect** → **Transaction pooler** (port **6543**). Looks like `postgresql://postgres.kqnyqkprxgzgpdkyhhqj:YOUR-PASSWORD@aws-0-<region>.pooler.supabase.com:6543/postgres`. URL-encode special characters in the password (`@` → `%40`, `#` → `%23`). |
| `SESSION_SECRET` | Any random string of 32+ characters — `openssl rand -base64 48` |
| `APP_URL` | The CRM's public URL, e.g. `https://crm.codevia.sa` (calendar and webhook links use it) |
| `APP_TIMEZONE` | `Asia/Riyadh` |
| `DEFAULT_LOCALE` | `ar` or `en` — language before a user picks one |
| `WEBHOOK_ALLOWED_ORIGINS` | `https://discovery.codevia.sa` — only needed if the form posts from the browser |

> Use the **pooler** URL on Vercel, not the direct `db.…supabase.co:5432` URL: serverless functions open many short connections and the direct host is IPv6-only.

3. Deploy, open the site → you'll land on **/setup** to create the first admin account. (Or `npm run db:create-admin -- you@codevia.sa "Your Name" "password"`.)
4. Optional: add the domain `crm.codevia.sa` in Vercel → Settings → Domains.

## 3. Connect the discovery form

In the CRM: **Settings → Lead connector → Create key** (name it `discovery.codevia.sa`, source *Discovery form*). Copy the key — it's shown once.

Add it to the discovery site's Vercel env as `CRM_API_KEY` and forward each submission from the site's **server** (keeps the key private). Keep the Google Sheet write if you like — just add this next to it:

```ts
// discovery site — inside the route handler / server action that saves the form
await fetch("https://crm.codevia.sa/api/webhooks/leads", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRM_API_KEY}` },
  body: JSON.stringify({
    company_name: form.companyName,
    contact_name: form.name,
    phone: form.phone,
    email: form.email,
    city: form.city,
    industry: form.sector,
    services: form.services,          // array or comma-separated text
    budget: form.budget,
    timeline: form.timeline,
    requirements: form.details,
    lead_score: score,
    preferred_language: locale,       // "ar" | "en"
    utm: { source: utm_source, medium: utm_medium, campaign: utm_campaign },
    answers: form,                    // every step's answers — shown on the client page
  }),
}).catch((err) => console.error("CRM sync failed", err));
```

Field names are matched loosely — `name`, `full_name`, `الاسم`, `رقم الجوال`, `whatsapp`, etc. all work; anything unrecognised is stored under *Discovery answers*. At least one of company, name, email or phone is required.

**Responses:** `201 {ok, id, outcome:"created"}` · `200 … "updated"` (same email/phone already exists) · `401` bad key · `422 missing_identity` · batch (JSON array) → `207` with per-item results.
A hidden honeypot field named `_gotcha` that bots fill in gets the lead rejected.

**Zapier / Make / ad platforms:** Webhooks → POST → URL above, header `Authorization: Bearer <key>` (or `X-API-Key: <key>`, or `?key=<key>` if the tool can't set headers). `GET` the same URL with the key to test the connection.

## 4. Calendar on iPhone

**Calendar → Subscribe on iPhone** (or Settings → Calendar feed) → **Open on this iPhone** → Subscribe. Or iPhone Settings → Calendar → Accounts → Add Account → Other → *Add Subscribed Calendar* and paste the link. iOS refreshes subscribed calendars on its own schedule (usually within 15 min–1 h). Anyone with the link can read meetings — use **Reset link** if it leaks.

## Local development

```bash
npm install
cp .env.example .env.local   # DATABASE_URL can be the direct or session-pooler URL locally
npm run db:migrate
npm run dev                  # http://localhost:3000
npm run typecheck
```

## Branding

Tokens live at the top of `src/app/globals.css` (black canvas, lime `#B8D433`, white). Arabic + Latin typeface is Readex Pro; to use Thmanyah, see `public/fonts/README.txt`.

## Project layout

```
db/schema.sql                 tables, indexes, triggers, RLS
scripts/                      migrate + create-admin CLIs
src/proxy.ts                  auth gate (Next 16 "proxy", formerly middleware)
src/lib/                      db, auth/session, i18n (EN/AR dictionaries), lead normalisation, queries, iCal writer
src/lib/actions/              server actions: auth, crm, import, settings
src/app/(auth)/               login, first-run setup
src/app/(app)/                dashboard, clients, pipeline, calendar, tasks, import, settings
src/app/api/                  webhooks/leads, calendar/[token].ics, export/clients, health
src/components/               UI kit, shell, charts, feature components
```
