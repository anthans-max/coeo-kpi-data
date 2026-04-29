"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const CARRIERS = ["bandwidth", "peerless", "inteliquent"] as const;
type Carrier = (typeof CARRIERS)[number];

export type ComputeSummary = {
  customersWritten: number;
  reconciliationRowsWritten: number;
  totalCdrs: number;
  totalMatched: number;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// Pull a whole table out of Supabase 1000 rows at a time.
async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  const all: T[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Fetch ${table} failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function computeProfitability(): Promise<ComputeSummary> {
  const supabase = await createClient();

  // 1. Inventory → TN-to-customer map.
  type InvRow = { identifier_tn: string | null; customer_id: string | null };
  const inventory = await fetchAll<InvRow>(
    supabase,
    "cogs_revio_inventory",
    "identifier_tn, customer_id",
  );
  const tnToCustomer = new Map<string, string>();
  for (const row of inventory) {
    if (row.identifier_tn && row.customer_id) {
      tnToCustomer.set(row.identifier_tn, row.customer_id);
    }
  }

  // 2. Carrier CDRs → cost per customer + per-carrier reconciliation counters.
  type CarrierRow = {
    carrier: string;
    call_date: string | null;
    terminating_tn: string;
    carrier_cost: number | string | null;
  };
  const carrierCdrs = await fetchAll<CarrierRow>(
    supabase,
    "cogs_carrier_cdr",
    "carrier, call_date, terminating_tn, carrier_cost",
  );

  type CustomerCost = {
    callCount: number;
    totalCost: number;
    minDate: string | null;
    maxDate: string | null;
  };
  const customerCost = new Map<string, CustomerCost>();

  type Counter = { total: number; matched: number; unmatched: number; zeroCost: number };
  const reconciliation: Record<Carrier, Counter> = {
    bandwidth: { total: 0, matched: 0, unmatched: 0, zeroCost: 0 },
    peerless: { total: 0, matched: 0, unmatched: 0, zeroCost: 0 },
    inteliquent: { total: 0, matched: 0, unmatched: 0, zeroCost: 0 },
  };

  for (const row of carrierCdrs) {
    if (!isCarrier(row.carrier)) continue;
    const counter = reconciliation[row.carrier];
    counter.total += 1;

    const cost = Number(row.carrier_cost) || 0;
    if (cost === 0) counter.zeroCost += 1;

    const customerId = tnToCustomer.get(row.terminating_tn);
    if (!customerId) {
      counter.unmatched += 1;
      continue;
    }
    counter.matched += 1;

    const bucket = customerCost.get(customerId) ?? {
      callCount: 0,
      totalCost: 0,
      minDate: null,
      maxDate: null,
    };
    bucket.callCount += 1;
    bucket.totalCost += cost;
    if (row.call_date) {
      if (!bucket.minDate || row.call_date < bucket.minDate) bucket.minDate = row.call_date;
      if (!bucket.maxDate || row.call_date > bucket.maxDate) bucket.maxDate = row.call_date;
    }
    customerCost.set(customerId, bucket);
  }

  // 3. Rated CDRs → revenue per customer.
  type RatedRow = {
    customer_id: string;
    charge: number | string | null;
    call_date: string | null;
  };
  const ratedCdrs = await fetchAll<RatedRow>(
    supabase,
    "cogs_revio_rated_cdr",
    "customer_id, charge, call_date",
  );

  type CustomerRevenue = {
    revenue: number;
    minDate: string | null;
    maxDate: string | null;
  };
  const customerRevenue = new Map<string, CustomerRevenue>();
  for (const row of ratedCdrs) {
    if (!row.customer_id) continue;
    const r = customerRevenue.get(row.customer_id) ?? {
      revenue: 0,
      minDate: null,
      maxDate: null,
    };
    r.revenue += Number(row.charge) || 0;
    if (row.call_date) {
      if (!r.minDate || row.call_date < r.minDate) r.minDate = row.call_date;
      if (!r.maxDate || row.call_date > r.maxDate) r.maxDate = row.call_date;
    }
    customerRevenue.set(row.customer_id, r);
  }

  // 4. Wipe prior compute results. Both tables have computed_at default now() so a
  //    > epoch filter satisfies Supabase's "WHERE clause required" rule.
  {
    const { error } = await supabase
      .from("cogs_voice_profitability")
      .delete()
      .gt("computed_at", "1970-01-01");
    if (error) throw new Error(`Wipe profitability failed: ${error.message}`);
  }
  {
    const { error } = await supabase
      .from("cogs_reconciliation_log")
      .delete()
      .gt("computed_at", "1970-01-01");
    if (error) throw new Error(`Wipe reconciliation log failed: ${error.message}`);
  }

  // 5. Profitability rows — one per customer that appears in either side.
  const customerIds = new Set<string>([
    ...customerCost.keys(),
    ...customerRevenue.keys(),
  ]);

  const profitabilityRows = Array.from(customerIds).map((customerId) => {
    const cost = customerCost.get(customerId);
    const rev = customerRevenue.get(customerId);
    const dates = [cost?.minDate, cost?.maxDate, rev?.minDate, rev?.maxDate].filter(
      (d): d is string => typeof d === "string" && d.length > 0,
    );
    const periodStart = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null;
    const periodEnd = dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null;

    return {
      customer_id: customerId,
      carrier: null,
      call_count: cost?.callCount ?? 0,
      total_revenue: rev?.revenue ?? 0,
      total_cost: cost?.totalCost ?? 0,
      period_start: periodStart,
      period_end: periodEnd,
    };
  });

  let customersWritten = 0;
  if (profitabilityRows.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < profitabilityRows.length; i += batchSize) {
      const batch = profitabilityRows.slice(i, i + batchSize);
      const { error } = await supabase.from("cogs_voice_profitability").insert(batch);
      if (error) throw new Error(`Insert profitability failed: ${error.message}`);
      customersWritten += batch.length;
    }
  }

  // 6. Reconciliation log — always 3 rows, one per carrier, even with zero data.
  const reconciliationRows = CARRIERS.map((c) => {
    const r = reconciliation[c];
    const matchRate = r.total > 0 ? r.matched / r.total : null;

    let notes: string | null = null;
    if (r.total === 0) {
      notes = "No CDRs uploaded for this carrier.";
    } else if (r.zeroCost / r.total > 0.95) {
      notes = `${r.zeroCost}/${r.total} rows have carrier_cost=0. Verify the cost field mapping in the parser.`;
    }

    return {
      carrier: c,
      total_cdrs: r.total,
      matched_cdrs: r.matched,
      unmatched_cdrs: r.unmatched,
      match_rate: matchRate,
      zero_cost_rows: r.zeroCost,
      notes,
    };
  });

  {
    const { error } = await supabase
      .from("cogs_reconciliation_log")
      .insert(reconciliationRows);
    if (error) throw new Error(`Insert reconciliation log failed: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/upload");

  const totalCdrs = CARRIERS.reduce((s, c) => s + reconciliation[c].total, 0);
  const totalMatched = CARRIERS.reduce((s, c) => s + reconciliation[c].matched, 0);

  return {
    customersWritten,
    reconciliationRowsWritten: reconciliationRows.length,
    totalCdrs,
    totalMatched,
  };
}

function isCarrier(value: string): value is Carrier {
  return (CARRIERS as readonly string[]).includes(value);
}
