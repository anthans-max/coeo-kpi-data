"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearSource,
  createUpload,
  finalizeUpload,
  insertBatch,
} from "@/app/actions/upload";
import { parseFor } from "@/lib/parse";
import {
  ALL_SOURCES,
  SOURCE_LABELS,
  type ParsedRow,
  type SourceType,
  type UploadStatus,
  type UploadStatusMap,
} from "@/lib/types";

const BATCH_SIZE = 500;

type ZoneState = {
  phase: "idle" | "parsing" | "uploading" | "done" | "error";
  parsedCount: number;
  totalRows: number;
  uploadedCount: number;
  warnings: string[];
  errorMessage?: string;
};

const initialZoneState: ZoneState = {
  phase: "idle",
  parsedCount: 0,
  totalRows: 0,
  uploadedCount: 0,
  warnings: [],
};

export function UploadClient({
  initialStatus,
}: {
  initialStatus: UploadStatusMap;
}) {
  const router = useRouter();
  const [zones, setZones] = useState<Record<SourceType, ZoneState>>(() =>
    ALL_SOURCES.reduce(
      (acc, s) => ({ ...acc, [s]: initialZoneState }),
      {} as Record<SourceType, ZoneState>,
    ),
  );

  const allLoaded = ALL_SOURCES.every((s) => initialStatus[s] !== null);
  const periodWarning = usePeriodWarning(initialStatus);

  function updateZone(source: SourceType, patch: Partial<ZoneState>) {
    setZones((prev) => ({ ...prev, [source]: { ...prev[source], ...patch } }));
  }

  async function handleFile(source: SourceType, file: File) {
    updateZone(source, { ...initialZoneState, phase: "parsing" });

    let csvText: string;
    try {
      csvText = await file.text();
    } catch (err) {
      updateZone(source, {
        phase: "error",
        errorMessage: `Could not read file: ${(err as Error).message}`,
      });
      return;
    }

    const result = parseFor(source, csvText);

    if (result.rows.length === 0) {
      updateZone(source, {
        phase: "error",
        errorMessage: "No valid rows found in file.",
        warnings: result.warnings,
        totalRows: 0,
        parsedCount: 0,
      });
      return;
    }

    updateZone(source, {
      phase: "uploading",
      totalRows: result.rows.length,
      parsedCount: result.rows.length,
      warnings: result.warnings,
    });

    let uploadId: string;
    try {
      uploadId = await createUpload(source, file.name);
    } catch (err) {
      updateZone(source, {
        phase: "error",
        errorMessage: `Could not create upload: ${(err as Error).message}`,
      });
      return;
    }

    let uploaded = 0;
    try {
      for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
        const batch = result.rows.slice(i, i + BATCH_SIZE);
        await insertBatch(uploadId, source, batch as ParsedRow[]);
        uploaded += batch.length;
        updateZone(source, { uploadedCount: uploaded });
      }
      await finalizeUpload(uploadId, uploaded, result.periodStart, result.periodEnd);
    } catch (err) {
      updateZone(source, {
        phase: "error",
        errorMessage: `Insert failed at row ${uploaded}: ${(err as Error).message}`,
        uploadedCount: uploaded,
      });
      return;
    }

    updateZone(source, { phase: "done", uploadedCount: uploaded });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {periodWarning && (
        <div className="rounded-card border border-orange/40 bg-orange/10 p-4 text-sm text-text-primary">
          <strong className="font-semibold text-navy">Period mismatch:</strong> {periodWarning}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ALL_SOURCES.map((source) => (
          <UploadZone
            key={source}
            source={source}
            status={initialStatus[source]}
            zone={zones[source]}
            onFile={(file) => handleFile(source, file)}
          />
        ))}
      </div>

      <ComputeBar allLoaded={allLoaded} />
    </div>
  );
}

function UploadZone({
  source,
  status,
  zone,
  onFile,
}: {
  source: SourceType;
  status: UploadStatus | null;
  zone: ZoneState;
  onFile: (file: File) => void;
}) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  }

  function onClear() {
    if (!confirm(`Clear all rows for ${SOURCE_LABELS[source]}?`)) return;
    startTransition(async () => {
      await clearSource(source);
      router.refresh();
    });
  }

  const progress =
    zone.phase === "uploading" && zone.totalRows > 0
      ? Math.round((zone.uploadedCount / zone.totalRows) * 100)
      : zone.phase === "done"
        ? 100
        : 0;

  return (
    <div className="rounded-card bg-white border border-border p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-navy">{SOURCE_LABELS[source]}</h3>
        <StatusPill status={status} />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-card border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-orange bg-orange/5"
            : "border-border hover:border-orange/60 hover:bg-cream/50"
        }`}
      >
        <label className="cursor-pointer block">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onPick}
          />
          <p className="text-sm text-text-secondary">
            <span className="text-navy font-medium underline">Choose a CSV</span>{" "}
            or drag and drop
          </p>
        </label>
      </div>

      {zone.phase !== "idle" && (
        <div className="space-y-2">
          {zone.phase === "uploading" && (
            <>
              <div className="h-2 rounded-pill bg-border-light overflow-hidden">
                <div
                  className="h-full bg-orange transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-text-secondary">
                Uploading {zone.uploadedCount.toLocaleString()} /{" "}
                {zone.totalRows.toLocaleString()} rows…
              </p>
            </>
          )}
          {zone.phase === "parsing" && (
            <p className="text-xs text-text-secondary">Parsing…</p>
          )}
          {zone.phase === "done" && (
            <p className="text-xs text-text-primary">
              ✓ Loaded {zone.uploadedCount.toLocaleString()} rows.
            </p>
          )}
          {zone.phase === "error" && (
            <p className="text-xs text-destructive">{zone.errorMessage}</p>
          )}
          {zone.warnings.length > 0 && (
            <ul className="text-xs text-text-secondary list-disc pl-4 space-y-0.5">
              {zone.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {status && (
        <button
          onClick={onClear}
          disabled={isPending}
          className="self-start text-xs text-destructive hover:underline disabled:opacity-50"
        >
          {isPending ? "Clearing…" : "Clear loaded data"}
        </button>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: UploadStatus | null }) {
  if (!status) {
    return (
      <span className="text-xs text-text-muted px-2 py-0.5 rounded-pill bg-border-light">
        Not loaded
      </span>
    );
  }
  const ts = new Date(status.uploadedAt);
  return (
    <span className="text-xs text-navy px-2 py-0.5 rounded-pill bg-cream">
      {status.rowCount.toLocaleString()} rows · {ts.toLocaleString()}
    </span>
  );
}

function ComputeBar({ allLoaded }: { allLoaded: boolean }) {
  return (
    <div className="rounded-card bg-white border border-border p-5 flex items-center justify-between">
      <div>
        <h3 className="font-semibold text-navy">Compute profitability</h3>
        <p className="text-xs text-text-secondary mt-1">
          {allLoaded
            ? "All six sources loaded. Compute action ships in Session 2."
            : "Upload all six sources to enable computation. Compute action ships in Session 2."}
        </p>
      </div>
      <button
        disabled
        className="rounded-pill bg-orange/40 px-5 py-2 text-white text-sm font-medium cursor-not-allowed"
        title="Available in Session 2"
      >
        Compute
      </button>
    </div>
  );
}

function usePeriodWarning(status: UploadStatusMap): string | null {
  return useMemo(() => {
    const ranges = ALL_SOURCES.map((s) => status[s])
      .filter(
        (st): st is UploadStatus =>
          st !== null && st.periodStart !== null && st.periodEnd !== null,
      )
      .map((st) => ({
        start: st.periodStart as string,
        end: st.periodEnd as string,
      }));
    if (ranges.length < 2) return null;

    const overallStart = ranges.reduce((a, b) => (a < b.start ? a : b.start), ranges[0].start);
    const overallEnd = ranges.reduce((a, b) => (a > b.end ? a : b.end), ranges[0].end);

    const overlaps = ranges.every((r) => r.start <= overallEnd && r.end >= overallStart);
    const allSame =
      ranges.every((r) => r.start === ranges[0].start) &&
      ranges.every((r) => r.end === ranges[0].end);
    if (allSame) return null;

    if (!overlaps) {
      return `Loaded files cover non-overlapping date ranges (${overallStart} — ${overallEnd}). Match results may be sparse.`;
    }
    return `Loaded files cover slightly different periods (${overallStart} — ${overallEnd}). Computation will still run.`;
  }, [status]);
}
