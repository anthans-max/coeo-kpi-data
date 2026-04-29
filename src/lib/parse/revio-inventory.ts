import Papa from "papaparse";
import {
  buildHeaderMap,
  getField,
  normaliseTN,
  parseDate,
  trackPeriod,
} from "../normalise";
import type { ParseResult, RevioInventoryRow } from "../types";

// Rev.IO Inventory Items — TN → customer mapping for join with carrier CDRs.
export function parseRevioInventory(csvText: string): ParseResult<RevioInventoryRow> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const warnings: string[] = [];
  for (const err of parsed.errors.slice(0, 5)) {
    warnings.push(`Row ${err.row}: ${err.message}`);
  }

  const rows: RevioInventoryRow[] = [];
  const period = { min: null as string | null, max: null as string | null };
  const headerMap = buildHeaderMap(parsed.meta.fields ?? []);

  let skippedNoTN = 0;
  let skippedNoCustomer = 0;

  for (const row of parsed.data) {
    const tn = normaliseTN(
      getField(row, headerMap, "identifier", "identifier_tn", "phone_number", "tn"),
    );
    if (!tn) {
      skippedNoTN++;
      continue;
    }

    const customerId = getField(row, headerMap, "customer_id", "customerid");
    if (!customerId) {
      skippedNoCustomer++;
      continue;
    }

    const snapshotDate = parseDate(
      getField(row, headerMap, "snapshot_date", "as_of_date", "date"),
    );
    trackPeriod(period, snapshotDate);

    rows.push({
      inventory_item_id:
        getField(row, headerMap, "inventory_item_id", "item_id") ?? null,
      inventory_type_id:
        getField(row, headerMap, "inventory_type_id", "type_id") ?? null,
      identifier_tn: tn,
      customer_id: customerId,
      status: getField(row, headerMap, "status") ?? null,
      snapshot_date: snapshotDate,
    });
  }

  if (skippedNoTN > 0) warnings.push(`${skippedNoTN} rows skipped: no usable identifier (TN).`);
  if (skippedNoCustomer > 0)
    warnings.push(`${skippedNoCustomer} rows skipped: no customer_id.`);

  return {
    rows,
    warnings,
    periodStart: period.min,
    periodEnd: period.max,
  };
}
