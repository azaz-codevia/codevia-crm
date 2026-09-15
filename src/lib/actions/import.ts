"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isSource, isStatus } from "@/lib/constants";
import { hasIdentity, normalizeLead, upsertLead } from "@/lib/leads";

export type ImportOptions = {
  defaultStatus: string;
  source: string;
  ownerId: string | null;
  duplicates: "skip" | "fill";
};

export type ImportChunkResult = {
  batchId: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
};

const MAX_CHUNK = 250;

/**
 * Imports one chunk of already-mapped rows. The browser sends the file in chunks so
 * large spreadsheets stay under the Server Action body limit and function timeout.
 */
export async function importChunk(input: {
  batchId: string | null;
  fileName: string;
  total: number;
  offset: number;
  rows: Record<string, unknown>[];
  options: ImportOptions;
}): Promise<ImportChunkResult> {
  const user = await requireUser();
  const sql = db();
  const rows = input.rows.slice(0, MAX_CHUNK);
  const o = input.options;
  const ownerId = o.ownerId && /^[0-9a-f-]{36}$/i.test(o.ownerId) ? o.ownerId : null;

  let batchId = input.batchId;
  if (!batchId || !/^[0-9a-f-]{36}$/i.test(batchId)) {
    const [b] = await sql<{ id: string }[]>`
      insert into import_batches (file_name, total, user_id)
      values (${input.fileName.slice(0, 250)}, ${Math.max(0, Math.floor(input.total))}, ${user.id}) returning id`;
    batchId = b.id;
  }

  const res: ImportChunkResult = { batchId, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = input.offset + i + 2; // +1 header, +1 human-friendly
    try {
      const lead = normalizeLead({ ...rows[i] });
      if (!hasIdentity(lead)) {
        res.skipped++;
        continue;
      }
      const out = await upsertLead(sql, lead, {
        userId: user.id,
        source: isSource(o.source) ? o.source : "excel_import",
        defaultStatus: isStatus(o.defaultStatus) ? o.defaultStatus : "new",
        ownerId,
        onDuplicate: o.duplicates === "fill" ? "fill" : "skip",
        activityType: "imported",
        activityData: { file: input.fileName, batch: batchId },
      });
      res[out.outcome]++;
    } catch (err) {
      res.failed++;
      if (res.errors.length < 20) res.errors.push({ row: rowNumber, message: err instanceof Error ? err.message.slice(0, 200) : "error" });
    }
  }

  await sql`update import_batches set
      created = created + ${res.created}, updated = updated + ${res.updated},
      skipped = skipped + ${res.skipped}, failed = failed + ${res.failed}
    where id = ${batchId}`;

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  revalidatePath("/import");
  return res;
}
