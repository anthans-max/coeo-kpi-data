// Shared types for the Coeo COGS app.
//
// SourceType is the canonical key for each upload kind — used in `cogs_uploads.source`,
// in routing parsers, and as the discriminator on the upload server action.

export type SourceType =
  | "bandwidth"
  | "peerless"
  | "inteliquent"
  | "revio_cdr"
  | "revio_inventory"
  | "razorflow_circuit";

export const ALL_SOURCES: SourceType[] = [
  "revio_cdr",
  "revio_inventory",
  "bandwidth",
  "peerless",
  "inteliquent",
  "razorflow_circuit",
];

export const SOURCE_LABELS: Record<SourceType, string> = {
  bandwidth: "Bandwidth CDR",
  peerless: "Peerless LD Term CDR",
  inteliquent: "Inteliquent CDR",
  revio_cdr: "Rev.IO Rated CDR",
  revio_inventory: "Rev.IO Inventory Items",
  razorflow_circuit: "RazorFlow Circuit Detail",
};

// DB-row shapes — column names match supabase/migrations/001_schema.sql exactly.
// `id` and `upload_id` are filled in by the server action.

export type CarrierCdrRow = {
  carrier: "bandwidth" | "peerless" | "inteliquent";
  call_date: string; // yyyy-mm-dd
  originating_tn: string | null;
  terminating_tn: string;
  duration_sec: number | null;
  carrier_cost: number;
  raw: Record<string, unknown>;
};

export type RevioInventoryRow = {
  inventory_item_id: string | null;
  inventory_type_id: string | null;
  identifier_tn: string;
  customer_id: string;
  status: string | null;
  snapshot_date: string | null;
};

export type RevioRatedCdrRow = {
  customer_id: string;
  cdr_id: string | null;
  call_date: string;
  product_type: string | null;
  charge: number;
  calling_number: string | null;
  called_number: string | null;
  duration_sec: number | null;
  raw: Record<string, unknown>;
};

export type CircuitCostRow = {
  circuit_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  customer_name: string | null;
  product_desc: string | null;
  state: string | null;
  billed_amount: number;
  mrc_from: string | null;
  mrc_thru: string | null;
  raw: Record<string, unknown>;
};

export type ParsedRow =
  | CarrierCdrRow
  | RevioInventoryRow
  | RevioRatedCdrRow
  | CircuitCostRow;

export type ParseResult<T> = {
  rows: T[];
  warnings: string[];
  periodStart: string | null;
  periodEnd: string | null;
  // Per-source diagnostic counts (e.g. zero_cost_rows for Inteliquent)
  diagnostics?: Record<string, number>;
};

export type UploadStatus = {
  uploadId: string;
  rowCount: number;
  uploadedAt: string;
  filename: string;
  periodStart: string | null;
  periodEnd: string | null;
};

export type UploadStatusMap = Record<SourceType, UploadStatus | null>;
