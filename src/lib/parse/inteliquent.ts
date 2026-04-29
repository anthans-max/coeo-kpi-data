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
import type { CarrierCdrRow, ParseResult } from "../types";

// Inteliquent CDR
//   Terminating TN: `term_tn`
//   Cost field:     `duration_charge`  (NOT `call_charge` — that field is zero
//                                       for ~99.96% of rows in production exports)
//   We still track call_charge=0 as a diagnostic so /reconciliation can flag it.
export function parseInteliquent(csvText: string): ParseResult<CarrierCdrRow> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const warnings: string[] = [];
  for (const err of parsed.errors.slice(0, 5)) {
    warnings.push(`Row ${err.row}: ${err.message}`);
  }

  const rows: CarrierCdrRow[] = [];
  const period = { min: null as string | null, max: null as string | null };
  const headerMap = buildHeaderMap(parsed.meta.fields ?? []);

  let skippedNoTN = 0;
  let skippedNoDate = 0;
  let zeroCallCharge = 0;
  let totalRows = 0;

  for (const row of parsed.data) {
    totalRows++;
    const term = normaliseTN(getField(row, headerMap, "term_tn", "terminating_tn"));
    if (!term) {
      skippedNoTN++;
      continue;
    }

    // Inteliquent uses call_date_gmt, already in "yyyy-mm-dd" form — pass through unchanged.
    const callDate = parseDate(
      getField(row, headerMap, "call_date_gmt", "call_date", "start_time", "call_start_time", "date"),
    );
    if (!callDate) {
      skippedNoDate++;
      continue;
    }
    trackPeriod(period, callDate);

    const orig = normaliseTN(getField(row, headerMap, "orig_tn", "originating_tn"));

    // Cost: duration_charge is the authoritative field; fall back to call_charge only
    // if duration_charge is missing entirely.
    const durationChargeRaw = getField(row, headerMap, "duration_charge");
    const callChargeRaw = getField(row, headerMap, "call_charge");
    const cost = parseAmount(durationChargeRaw ?? callChargeRaw);

    if (callChargeRaw !== undefined && parseAmount(callChargeRaw) === 0) {
      zeroCallCharge++;
    }

    const duration = parseInteger(
      getField(row, headerMap, "duration", "duration_sec", "billed_seconds", "seconds"),
    );

    rows.push({
      carrier: "inteliquent",
      call_date: callDate,
      originating_tn: orig || null,
      terminating_tn: term,
      duration_sec: duration,
      carrier_cost: cost,
      raw: row,
    });
  }

  if (skippedNoTN > 0) warnings.push(`${skippedNoTN} rows skipped: no usable term_tn.`);
  if (skippedNoDate > 0) warnings.push(`${skippedNoDate} rows skipped: no usable call date.`);

  if (totalRows > 0 && zeroCallCharge / totalRows > 0.95) {
    warnings.push(
      `${zeroCallCharge}/${totalRows} rows have call_charge=0. Using duration_charge as the cost field (expected behaviour for Inteliquent exports).`,
    );
  }

  return {
    rows,
    warnings,
    periodStart: period.min,
    periodEnd: period.max,
    diagnostics: { zero_call_charge: zeroCallCharge, total_rows: totalRows },
  };
}
