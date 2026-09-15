"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { importChunk, type ImportOptions } from "@/lib/actions/import";
import { SOURCES, STATUSES } from "@/lib/constants";
import { fieldLabel, IMPORT_FIELDS, type LeadField } from "@/lib/field-labels";
import { fmt } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/client";
import { matchField } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { Button, Card, CardTitle, Field, LinkButton, Select } from "@/components/ui";

type Sheet = { fileName: string; headers: string[]; rows: unknown[][] };
type Mapping = Partial<Record<LeadField, number>>;
type Totals = { created: number; updated: number; skipped: number; failed: number; errors: { row: number; message: string }[] };

const CHUNK = 100;

function cellToValue(v: unknown) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v.trim() || null;
  return v;
}

async function parseFile(file: File): Promise<Sheet> {
  const name = file.name.toLowerCase();
  let grid: unknown[][];
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
    grid = parsed.data;
  } else {
    const { readSheet } = await import("read-excel-file/browser");
    grid = (await readSheet(file)) as unknown[][];
  }
  // First non-empty row is the header row
  const headerIndex = grid.findIndex((r) => r.some((c) => c != null && String(c).trim() !== ""));
  if (headerIndex < 0) throw new Error("empty");
  const width = Math.max(...grid.slice(headerIndex, headerIndex + 50).map((r) => r.length));
  const headers = Array.from({ length: width }, (_, i) => {
    const h = grid[headerIndex][i];
    return h == null || String(h).trim() === "" ? `Column ${i + 1}` : String(h).trim();
  });
  const rows = grid.slice(headerIndex + 1).filter((r) => r.some((c) => c != null && String(c).trim() !== ""));
  return { fileName: file.name, headers, rows };
}

function autoMap(headers: string[]): Mapping {
  const m: Mapping = {};
  headers.forEach((h, i) => {
    const f = matchField(h);
    if (f && m[f] === undefined) m[f] = i;
  });
  return m;
}

export function ImportWizard({ team, currentUserId }: { team: { id: string; name: string }[]; currentUserId: string }) {
  const { t } = useI18n();
  const ti = t.import;
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "running" | "done">("upload");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [options, setOptions] = useState<ImportOptions>({ defaultStatus: "new", source: "excel_import", ownerId: currentUserId, duplicates: "skip" });
  const [progress, setProgress] = useState(0);
  const [totals, setTotals] = useState<Totals>({ created: 0, updated: 0, skipped: 0, failed: 0, errors: [] });
  const [dragging, setDragging] = useState(false);

  const mappedCols = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const hasIdentityColumn = ["company_name", "contact_name", "email", "phone"].some((f) => mapping[f as LeadField] !== undefined);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParsing(true);
    setParseError(false);
    try {
      const s = await parseFile(file);
      setSheet(s);
      setMapping(autoMap(s.headers));
      setStep("map");
    } catch {
      setParseError(true);
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function buildRow(row: unknown[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [field, col] of Object.entries(mapping)) {
      if (col !== undefined) out[field] = cellToValue(row[col]);
    }
    // Unmapped columns are preserved as discovery answers on the client
    sheet!.headers.forEach((h, i) => {
      if (!mappedCols.has(i)) {
        const v = cellToValue(row[i]);
        if (v != null) out[`sheet: ${h}`] = v;
      }
    });
    return out;
  }

  async function run() {
    if (!sheet) return;
    setStep("running");
    setProgress(0);
    const acc: Totals = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };
    let batchId: string | null = null;
    for (let offset = 0; offset < sheet.rows.length; offset += CHUNK) {
      const slice = sheet.rows.slice(offset, offset + CHUNK).map(buildRow);
      try {
        const r = await importChunk({ batchId, fileName: sheet.fileName, total: sheet.rows.length, offset, rows: slice, options });
        batchId = r.batchId;
        acc.created += r.created;
        acc.updated += r.updated;
        acc.skipped += r.skipped;
        acc.failed += r.failed;
        acc.errors.push(...r.errors);
      } catch {
        acc.failed += slice.length;
        acc.errors.push({ row: offset + 2, message: t.common.error });
      }
      setProgress(Math.min(sheet.rows.length, offset + CHUNK));
      setTotals({ ...acc });
    }
    setStep("done");
  }

  function downloadTemplate() {
    const headers = ["Company", "Full name", "Job title", "Email", "Phone", "City", "Industry", "Company size", "Website", "Services", "Budget", "Timeline", "Requirements", "Status", "Priority", "Lead score", "Deal value", "Campaign", "Tags"];
    const example = ["Al Noor Trading", "Faisal Alharbi", "Operations Manager", "faisal@alnoor.sa", "0551234567", "Jeddah", "Retail", "50-200", "alnoor.sa", "ERP, Mobile app", "100k-250k SAR", "Next quarter", "Inventory across 6 branches", "new", "high", "80", "180000", "ramadan-2026", "retail, jeddah"];
    const csv = "\uFEFF" + [headers, example].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "codevia-leads-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setSheet(null);
    setMapping({});
    setTotals({ created: 0, updated: 0, skipped: 0, failed: 0, errors: [] });
    setStep("upload");
  }

  if (step === "upload") {
    return (
      <Card className="p-5 md:p-8">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-14 text-center transition-colors",
            dragging ? "border-lime bg-lime/5" : "border-line-strong hover:border-lime/60",
          )}
        >
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-lime/10 text-lime">
            <FileSpreadsheet className="h-7 w-7" aria-hidden />
          </span>
          <span className="text-base font-medium">{parsing ? ti.parsing : ti.drop}</span>
          <span className="text-sm text-muted">{ti.dropHint}</span>
          <span className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-lime px-5 text-sm font-medium text-black">
            <Upload className="h-4 w-4" aria-hidden /> {ti.drop}
          </span>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            disabled={parsing}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
        {parseError && (
          <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {ti.parseError}
          </p>
        )}
        <div className="mt-5 flex justify-center">
          <Button variant="ghost" onClick={downloadTemplate}>
            <Download className="h-4 w-4" aria-hidden /> {ti.template}
          </Button>
        </div>
      </Card>
    );
  }

  if (!sheet) return null;

  if (step === "running" || step === "done") {
    const pct = sheet.rows.length ? Math.round((progress / sheet.rows.length) * 100) : 100;
    return (
      <Card className="p-6 md:p-8">
        {step === "running" ? (
          <>
            <p className="text-base font-medium">{fmt(ti.importing, { done: progress, total: sheet.rows.length })}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-lime transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-lime" aria-hidden />
            <h2 className="text-xl font-semibold">{ti.doneTitle}</h2>
          </div>
        )}
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ["createdN", totals.created, "text-lime"],
            ["updatedN", totals.updated, "text-info"],
            ["skippedN", totals.skipped, "text-soft"],
            ["failedN", totals.failed, "text-danger"],
          ] as const).map(([key, n, tone]) => (
            <div key={key} className="rounded-2xl bg-raised px-4 py-3 ring-1 ring-inset ring-line">
              <dd className={cn("num text-2xl font-semibold", tone)}>{n}</dd>
              <dt className="text-xs text-muted">{fmt(ti[key], { count: "" }).trim()}</dt>
            </div>
          ))}
        </dl>
        {totals.errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl bg-danger/10 px-4 py-3 text-xs text-danger">
            {totals.errors.slice(0, 10).map((e, i) => (
              <li key={i} dir="ltr" className="text-start">Row {e.row}: {e.message}</li>
            ))}
          </ul>
        )}
        {step === "done" && (
          <div className="mt-6 flex flex-wrap gap-2">
            <LinkButton href="/clients?sort=newest">{ti.viewClients}</LinkButton>
            <Button variant="secondary" onClick={reset}>{ti.another}</Button>
          </div>
        )}
      </Card>
    );
  }

  // step === "map"
  const preview = sheet.rows.slice(0, 5);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-soft">
        {fmt(ti.rowsFound, { count: sheet.rows.length, file: sheet.fileName })}{" "}
        <button type="button" onClick={reset} className="text-lime underline-offset-4 hover:underline">{ti.another}</button>
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle>{ti.mapTitle}</CardTitle>
          <p className="-mt-1 px-5 pb-4 text-sm text-muted">{ti.mapHint}</p>
          <div className="grid gap-x-4 gap-y-3 px-5 pb-5 sm:grid-cols-2">
            {IMPORT_FIELDS.map((f) => {
              const col = mapping[f];
              const sample = col !== undefined ? preview.map((r) => cellToValue(r[col])).find((v) => v != null) : null;
              return (
                <Field key={f} label={fieldLabel(t, f)} hint={sample != null ? String(sample).slice(0, 60) : undefined}>
                  <Select
                    value={col ?? ""}
                    className={cn(col !== undefined && "ring-lime/50")}
                    onChange={(e) =>
                      setMapping((m) => {
                        const next = { ...m };
                        if (e.target.value === "") delete next[f];
                        else next[f] = Number(e.target.value);
                        return next;
                      })
                    }
                  >
                    <option value="">{ti.ignore}</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </Select>
                </Field>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>{ti.options}</CardTitle>
            <div className="flex flex-col gap-3 px-5 pb-5">
              <Field label={ti.defaultStatus}>
                <Select value={options.defaultStatus} onChange={(e) => setOptions({ ...options, defaultStatus: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
                </Select>
              </Field>
              <Field label={ti.defaultSource}>
                <Select value={options.source} onChange={(e) => setOptions({ ...options, source: e.target.value })}>
                  {SOURCES.map((s) => <option key={s} value={s}>{t.source[s]}</option>)}
                </Select>
              </Field>
              <Field label={ti.assignTo}>
                <Select value={options.ownerId ?? ""} onChange={(e) => setOptions({ ...options, ownerId: e.target.value || null })}>
                  <option value="">{t.common.unassigned}</option>
                  {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1.5 text-[13px] font-medium text-soft">{ti.duplicates}</legend>
                {(["skip", "fill"] as const).map((d) => (
                  <label key={d} className="flex items-center gap-2.5 text-sm">
                    <input type="radio" name="dup" className="accent-[#b8d433]" checked={options.duplicates === d} onChange={() => setOptions({ ...options, duplicates: d })} />
                    {d === "skip" ? ti.dupSkip : ti.dupUpdate}
                  </label>
                ))}
              </fieldset>
            </div>
          </Card>

          <Button className="justify-center" disabled={!hasIdentityColumn || sheet.rows.length === 0} onClick={run}>
            {fmt(ti.start, { count: sheet.rows.length })}
          </Button>
          {!hasIdentityColumn && <p className="text-sm text-warn">{ti.needName}</p>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardTitle>{ti.preview}</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-y border-line text-start text-xs text-muted">
                {sheet.headers.map((h, i) => (
                  <th key={i} className={cn("px-4 py-2 text-start font-medium", mappedCols.has(i) && "text-lime")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, ri) => (
                <tr key={ri} className="border-b border-line last:border-b-0">
                  {sheet.headers.map((_, ci) => (
                    <td key={ci} className="max-w-56 truncate px-4 py-2 text-soft">{String(cellToValue(r[ci]) ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
