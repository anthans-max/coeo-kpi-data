"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  CarrierCdrRow,
  CircuitCostRow,
  ParsedRow,
  RevioInventoryRow,
  RevioRatedCdrRow,
  SourceType,
  UploadStatus,
  UploadStatusMap,
} from "@/lib/types";
import { ALL_SOURCES } from "@/lib/types";

const TABLE_BY_SOURCE: Record<SourceType, string> = {
  bandwidth: "cogs_carrier_cdr",
  peerless: "cogs_carrier_cdr",
  inteliquent: "cogs_carrier_cdr",
  revio_cdr: "cogs_revio_rated_cdr",
  revio_inventory: "cogs_revio_inventory",
  razorflow_circuit: "cogs_circuit_cost",
};

// Create the cogs_uploads row first; clearSource removes any prior data for this
// source (cascading via FK) before we begin streaming new rows.
export async function createUpload(
  source: SourceType,
  filename: string,
): Promise<string> {
  const supabase = await createClient();

  // Replace any existing upload for this source.
  await supabase.from("cogs_uploads").delete().eq("source", source);

  const { data, error } = await supabase
    .from("cogs_uploads")
    .insert({ source, filename, row_count: 0 })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create upload row: ${error?.message ?? "unknown error"}`);
  }
  return data.id as string;
}

export async function insertBatch(
  uploadId: string,
  source: SourceType,
  rows: ParsedRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = await createClient();
  const table = TABLE_BY_SOURCE[source];

  const payload = rows.map((row) => shapeForTable(source, uploadId, row));

  const { error } = await supabase.from(table).insert(payload);
  if (error) {
    throw new Error(`Insert into ${table} failed: ${error.message}`);
  }
}

export async function finalizeUpload(
  uploadId: string,
  rowCount: number,
  periodStart: string | null,
  periodEnd: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cogs_uploads")
    .update({
      row_count: rowCount,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .eq("id", uploadId);

  if (error) throw new Error(`Failed to finalize upload: ${error.message}`);
  revalidatePath("/upload");
}

export async function clearSource(source: SourceType): Promise<void> {
  const supabase = await createClient();
  // FK on cogs_uploads(id) cascades to all child rows for this upload.
  const { error } = await supabase.from("cogs_uploads").delete().eq("source", source);
  if (error) throw new Error(`Failed to clear ${source}: ${error.message}`);
  revalidatePath("/upload");
}

export async function getUploadStatus(): Promise<UploadStatusMap> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cogs_uploads")
    .select("id, source, filename, row_count, uploaded_at, period_start, period_end")
    .order("uploaded_at", { ascending: false });

  const map = ALL_SOURCES.reduce<UploadStatusMap>((acc, s) => {
    acc[s] = null;
    return acc;
  }, {} as UploadStatusMap);

  if (error || !data) return map;

  for (const row of data) {
    const source = row.source as SourceType;
    if (!(source in map)) continue;
    if (map[source] !== null) continue; // keep most recent
    const status: UploadStatus = {
      uploadId: row.id as string,
      rowCount: (row.row_count as number) ?? 0,
      uploadedAt: row.uploaded_at as string,
      filename: (row.filename as string) ?? "",
      periodStart: (row.period_start as string | null) ?? null,
      periodEnd: (row.period_end as string | null) ?? null,
    };
    map[source] = status;
  }

  return map;
}

// ----------------------------------------------------------------------------
// Per-source row shaping — converts ParsedRow into the exact column set the
// destination Supabase table expects.
// ----------------------------------------------------------------------------

function shapeForTable(
  source: SourceType,
  uploadId: string,
  row: ParsedRow,
): Record<string, unknown> {
  switch (source) {
    case "bandwidth":
    case "peerless":
    case "inteliquent": {
      const r = row as CarrierCdrRow;
      return {
        upload_id: uploadId,
        carrier: r.carrier,
        call_date: r.call_date,
        originating_tn: r.originating_tn,
        terminating_tn: r.terminating_tn,
        duration_sec: r.duration_sec,
        carrier_cost: r.carrier_cost,
        raw: r.raw,
      };
    }
    case "revio_cdr": {
      const r = row as RevioRatedCdrRow;
      return {
        upload_id: uploadId,
        customer_id: r.customer_id,
        cdr_id: r.cdr_id,
        call_date: r.call_date,
        product_type: r.product_type,
        charge: r.charge,
        calling_number: r.calling_number,
        called_number: r.called_number,
        duration_sec: r.duration_sec,
        raw: r.raw,
      };
    }
    case "revio_inventory": {
      const r = row as RevioInventoryRow;
      return {
        upload_id: uploadId,
        inventory_item_id: r.inventory_item_id,
        inventory_type_id: r.inventory_type_id,
        identifier_tn: r.identifier_tn,
        customer_id: r.customer_id,
        status: r.status,
        snapshot_date: r.snapshot_date,
      };
    }
    case "razorflow_circuit": {
      const r = row as CircuitCostRow;
      return {
        upload_id: uploadId,
        circuit_id: r.circuit_id,
        invoice_number: r.invoice_number,
        invoice_date: r.invoice_date,
        customer_name: r.customer_name,
        product_desc: r.product_desc,
        state: r.state,
        billed_amount: r.billed_amount,
        mrc_from: r.mrc_from,
        mrc_thru: r.mrc_thru,
        raw: r.raw,
      };
    }
  }
}
