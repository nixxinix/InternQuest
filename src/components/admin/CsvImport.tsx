"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { previewCsvImport, runCsvImport, type ImportCounts, type ImportPreviewRow } from "@/app/actions/adminImport";
import { logOut } from "@/app/actions/auth";
import { FormError } from "@/components/auth/AuthShell";
import { BusinessHeader, HEADER_LINK } from "@/components/layout/BusinessHeader";
import { Button } from "@/components/ui/Button";
import { CSV_COLUMNS, CSV_MAX_ROWS, CSV_TEMPLATE } from "@/lib/admin/csvImport";
import { FIELDS } from "@/lib/catalog/fields";
import { cn } from "@/lib/cn";

type Stage =
  | { kind: "choose" }
  | { kind: "checking"; fileName: string }
  | { kind: "preview"; fileName: string; text: string; rows: ImportPreviewRow[]; counts: ImportCounts }
  | { kind: "importing"; fileName: string; rows: ImportPreviewRow[]; counts: ImportCounts }
  | { kind: "done"; fileName: string; counts: ImportCounts; failed: number };

const OUTCOME: Record<ImportPreviewRow["outcome"], { label: string; className: string }> = {
  new: { label: "New", className: "text-green" },
  update: { label: "Updates an earlier import", className: "text-green" },
  "replaces-aggregator": { label: "Replaces a JSearch copy", className: "text-green" },
  "company-post-wins": { label: "Skipped: the company posted it", className: "text-muted" },
  error: { label: "Not imported", className: "text-alert" },
};

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;
const NETWORK = "Couldn't reach InternQuest. Check your connection and try again.";

/** Admin: bring in listings from a spreadsheet (SPEC §5.3). No game elements (CLAUDE.md). */
export function CsvImport() {
  const [stage, setStage] = useState<Stage>({ kind: "choose" });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const focusResult = () => requestAnimationFrame(() => resultRef.current?.focus());

  const onFile = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > 1_000_000) {
      setError("That file is over 1 MB. Split it into smaller files.");
      return;
    }
    setStage({ kind: "checking", fileName: file.name });
    const text = await file.text();
    const res = await previewCsvImport(text).catch(() => ({ ok: false as const, error: NETWORK }));
    if (!res.ok) {
      setError(res.error);
      setStage({ kind: "choose" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setStage({ kind: "preview", fileName: file.name, text, rows: res.rows, counts: res.counts });
    focusResult();
  };

  const onImport = async () => {
    if (stage.kind !== "preview") return;
    setError(null);
    setStage({ kind: "importing", fileName: stage.fileName, rows: stage.rows, counts: stage.counts });
    const res = await runCsvImport(stage.text, stage.fileName).catch(() => ({ ok: false as const, error: NETWORK }));
    if (!res.ok) {
      setError(res.error);
      setStage(stage);
      return;
    }
    setStage({ kind: "done", fileName: stage.fileName, counts: res.counts, failed: res.failed });
    focusResult();
  };

  const reset = () => {
    setError(null);
    setStage({ kind: "choose" });
    requestAnimationFrame(() => fileRef.current?.focus());
  };

  return (
    <>
      <BusinessHeader area="admin" home="/admin">
        <Link href="/admin" className={HEADER_LINK}>
          Review queue
        </Link>
        <form action={logOut}>
          <button type="submit" className={HEADER_LINK}>
            Log out
          </button>
        </form>
      </BusinessHeader>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-gutter pb-16 pt-6 lg:pt-10">
        <h1 className="text-2xl font-semibold lg:text-3xl">Import listings</h1>
        <p className="mt-2 text-base text-muted">
          Add listings from a spreadsheet saved as CSV. They show as &ldquo;Added by admin&rdquo;. You&apos;ll see every row
          before anything is saved.
        </p>

        {error && (
          <div className="mt-5">
            <FormError message={error} />
          </div>
        )}

        {(stage.kind === "choose" || stage.kind === "checking") && (
          <section aria-labelledby="choose-h" className="mt-6 border border-line bg-screen p-5">
            <h2 id="choose-h" className="text-lg font-semibold">
              Choose a file
            </h2>
            <p className="mt-1 text-sm text-muted">Up to {CSV_MAX_ROWS} rows and 1 MB. Excel: File → Save As → CSV UTF-8.</p>
            <label htmlFor="csv-file" className="mt-4 block font-semibold">
              CSV file
            </label>
            <input
              ref={fileRef}
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              disabled={stage.kind === "checking"}
              onChange={(e) => void onFile(e.target.files?.[0])}
              className="mt-1 block w-full min-h-tap border border-muted bg-screen p-2 text-base file:mr-3 file:border-0 file:bg-canvas file:px-3 file:py-2 file:font-semibold"
            />
            {stage.kind === "checking" && (
              <p role="status" className="mt-3 text-base">
                Checking {stage.fileName}…
              </p>
            )}
            <p className="mt-4">
              <a href={TEMPLATE_HREF} download="internquest-listings-template.csv" className="font-semibold text-green underline underline-offset-4">
                Download the template
              </a>
            </p>
            <details className="mt-3">
              <summary className="min-h-tap cursor-pointer py-2 font-semibold">What each column means</summary>
              <dl className="mt-2 space-y-2 text-sm">
                <Col name="title">The role, like &ldquo;Data Encoder Intern&rdquo;. 3 to 120 characters.</Col>
                <Col name="company">The company&apos;s name as interns should see it.</Col>
                <Col name="field">
                  One of: {FIELDS.map((f) => f.label).join(", ")}.
                </Col>
                <Col name="city">A city, like &ldquo;Pasig&rdquo; or &ldquo;Lipa, Batangas&rdquo;. Can be empty for remote.</Col>
                <Col name="work_type">onsite, hybrid, or remote.</Col>
                <Col name="description">What the intern will do. At least 40 characters; up to 600 are kept.</Col>
                <Col name="apply">An https:// link, or an email address.</Col>
                <Col name="deadline" optional>
                  Like 2026-12-15.
                </Col>
                <Col name="allowance" optional>
                  Free text, like &ldquo;PHP 300/day&rdquo;.
                </Col>
                <Col name="hours" optional>
                  OJT hours, like 486.
                </Col>
                <Col name="moa" optional>
                  yes if the company can sign a school MOA.
                </Col>
                <Col name="skills" optional>
                  Separated by semicolons. Add * for required: &ldquo;Excel*; SQL&rdquo;.
                </Col>
              </dl>
              <p className="mt-2 text-sm text-muted">
                Required: {CSV_COLUMNS.required.join(", ")}. The same company, title, and city updates the earlier import
                instead of adding a copy. A company&apos;s own post is never changed.
              </p>
            </details>
          </section>
        )}

        {(stage.kind === "preview" || stage.kind === "importing") && (
          <section aria-labelledby="preview-h" className="mt-6">
            <h2 id="preview-h" ref={resultRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
              {stage.fileName}: {stage.rows.length} {stage.rows.length === 1 ? "row" : "rows"}
            </h2>
            <Summary counts={stage.counts} />
            <ol className="mt-4 divide-y divide-line border border-line bg-screen">
              {stage.rows.map((r) => (
                <li key={r.line} className="p-3">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold">
                      <span className="text-sm font-normal text-muted">Row {r.line} · </span>
                      {r.title || "(no title)"}
                      {r.company && <span className="font-normal"> at {r.company}</span>}
                    </span>
                    <span className={cn("text-sm font-semibold", OUTCOME[r.outcome].className)}>{OUTCOME[r.outcome].label}</span>
                  </p>
                  {r.errors.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-sm text-alert">
                      {r.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                  {r.warnings.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                      {r.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="lg" onClick={() => void onImport()} loading={stage.kind === "importing"} disabled={importable(stage.counts) === 0}>
                {importable(stage.counts) === 0
                  ? "Nothing to import"
                  : `Import ${importable(stage.counts)} ${importable(stage.counts) === 1 ? "listing" : "listings"}`}
              </Button>
              <Button size="lg" variant="secondary" onClick={reset} disabled={stage.kind === "importing"}>
                Choose another file
              </Button>
            </div>
            {stage.counts.errors > 0 && (
              <p className="mt-2 text-sm text-muted">Rows marked &ldquo;Not imported&rdquo; are left out. Fix them in the file and import it again.</p>
            )}
          </section>
        )}

        {stage.kind === "done" && (
          <section aria-labelledby="done-h" className="mt-6 border-l-4 border-green bg-green-tint p-5">
            <h2 id="done-h" ref={resultRef} tabIndex={-1} className="text-xl font-semibold focus:outline-none">
              Imported {importable(stage.counts) - stage.failed} {importable(stage.counts) - stage.failed === 1 ? "listing" : "listings"}
            </h2>
            <p className="mt-1 text-base">
              From {stage.fileName}. They appear in search within a minute, and the import is in the audit log.
            </p>
            {stage.failed > 0 && (
              <p className="mt-2 text-base font-semibold text-alert">
                {stage.failed} {stage.failed === 1 ? "row" : "rows"} couldn&apos;t be saved. Try importing the file again.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={reset}>Import another file</Button>
              <Link href="/search" className="inline-flex min-h-tap items-center px-3 font-semibold text-green underline-offset-4 hover:underline">
                See the listings
              </Link>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

const importable = (c: ImportCounts) => c.new + c.update + c.replaces;

function Summary({ counts }: { counts: ImportCounts }) {
  const parts = [
    counts.new + counts.replaces && `${counts.new + counts.replaces} new`,
    counts.update && `${counts.update} updated`,
    counts.skipped && `${counts.skipped} left to the company's own post`,
    counts.errors && `${counts.errors} with errors`,
  ].filter(Boolean);
  return <p className="mt-1 text-base text-muted">{parts.join(" · ") || "Nothing in this file."}</p>;
}

function Col({ name, optional, children }: { name: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline font-mono font-semibold">{name}</dt>
      {optional && <span className="text-muted"> (optional)</span>}
      <dd className="inline">: {children}</dd>
    </div>
  );
}
