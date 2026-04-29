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

// Bandwidth CDR
//   Terminating TN: `call_destination` (E.164 — strip +1 via normaliseTN)
//   Cost field:     `amount`
export function parseBandwidth(csvText: string): ParseResult<CarrierCdrRow> {
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

  for (const row of parsed.data) {
    const termRaw = getField(row, headerMap, "call_destination", "destination");
    const term = normaliseTN(termRaw);
    if (!term) {
      skippedNoTN++;
      continue;
    }

    // Bandwidth uses call_start_datetime ("2026-04-27 23:59:17.000").
    // Slice to the first 10 chars so parseDate sees a clean "yyyy-mm-dd".
    const dateRaw = getField(
      row,
      headerMap,
      "call_start_datetime",
      "call_date",
      "date",
      "call_start_time",
      "start_time",
      "timestamp",
    );
    const callDate = parseDate(dateRaw ? dateRaw.slice(0, 10) : dateRaw);
    if (!callDate) {
      skippedNoDate++;
      continue;
    }
    trackPeriod(period, callDate);

    const orig = normaliseTN(
      getField(row, headerMap, "call_origination", "origination", "calling_number"),
    );
    const cost = parseAmount(getField(row, headerMap, "amount", "billable_amount", "charge"));
    const duration = parseInteger(
      getField(row, headerMap, "duration", "duration_sec", "billed_seconds", "seconds"),
    );

    rows.push({
      carrier: "bandwidth",
      call_date: callDate,
      originating_tn: orig || null,
      terminating_tn: term,
      duration_sec: duration,
      carrier_cost: cost,
      raw: row,
    });
  }

  if (skippedNoTN > 0) warnings.push(`${skippedNoTN} rows skipped: no usable call_destination.`);
  if (skippedNoDate > 0) warnings.push(`${skippedNoDate} rows skipped: no usable call date.`);

  return {
    rows,
    warnings,
    periodStart: period.min,
    periodEnd: period.max,
  };
}
