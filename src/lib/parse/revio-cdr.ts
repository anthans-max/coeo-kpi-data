import Papa from "papaparse";
import {
  buildHeaderMap,
  getField,
  normaliseTN,
  parseAmount,
  parseDate,
  parseInteger,
  trackPeriod,
} from "../normalise";
import type { ParseResult, RevioRatedCdrRow } from "../types";

// Rev.IO Rated CDR (revenue side).
//   Customer key:   `customer_id`
//   Charge:         `charge`  (cost_charge is always 0 — do NOT use it)
//   Phone numbers normalised on both calling and called sides.
export function parseRevioCdr(csvText: string): ParseResult<RevioRatedCdrRow> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const warnings: string[] = [];
  for (const err of parsed.errors.slice(0, 5)) {
    warnings.push(`Row ${err.row}: ${err.message}`);
  }

  const rows: RevioRatedCdrRow[] = [];
  const period = { min: null as string | null, max: null as string | null };
  const headerMap = buildHeaderMap(parsed.meta.fields ?? []);

  let skippedNoCustomer = 0;
  let skippedNoDate = 0;
  let zeroCostCharge = 0;
  let totalRows = 0;

  for (const row of parsed.data) {
    totalRows++;

    const customerId = getField(row, headerMap, "customer_id", "customerid");
    if (!customerId) {
      skippedNoCustomer++;
      continue;
    }

    const callDate = parseDate(
      getField(row, headerMap, "call_date", "start_time", "call_start_time", "date"),
    );
    if (!callDate) {
      skippedNoDate++;
      continue;
    }
    trackPeriod(period, callDate);

    const charge = parseAmount(getField(row, headerMap, "charge", "rated_charge", "amount"));

    // cost_charge is documented as zero in production exports — track but don't use.
    const costCharge = getField(row, headerMap, "cost_charge");
    if (costCharge !== undefined && parseAmount(costCharge) === 0) zeroCostCharge++;

    const calling = normaliseTN(getField(row, headerMap, "calling_number", "from_number"));
    const called = normaliseTN(getField(row, headerMap, "called_number", "to_number"));
    const cdrId = getField(row, headerMap, "cdr_id", "id");
    const productType = getField(row, headerMap, "product_type", "product");
    const duration = parseInteger(
      getField(row, headerMap, "duration", "duration_sec", "billed_seconds", "seconds"),
    );

    rows.push({
      customer_id: customerId,
      cdr_id: cdrId ?? null,
      call_date: callDate,
      product_type: productType ?? null,
      charge,
      calling_number: calling || null,
      called_number: called || null,
      duration_sec: duration,
      raw: row,
    });
  }

  if (skippedNoCustomer > 0)
    warnings.push(`${skippedNoCustomer} rows skipped: no customer_id.`);
  if (skippedNoDate > 0) warnings.push(`${skippedNoDate} rows skipped: no usable call date.`);
  if (totalRows > 0 && zeroCostCharge === totalRows) {
    warnings.push(
      `All ${totalRows} rows have cost_charge=0 (expected — Rev.IO does not populate this field; carrier cost is sourced from raw CDR files).`,
    );
  }

  return {
    rows,
    warnings,
    periodStart: period.min,
    periodEnd: period.max,
    diagnostics: { zero_cost_charge: zeroCostCharge, total_rows: totalRows },
  };
}
