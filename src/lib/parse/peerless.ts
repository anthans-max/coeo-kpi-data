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

// Peerless LD Term CDR
//   Terminating TN: `terminating_phone_number` (10-digit already)
//   Cost field:     `billable_amount`
export function parsePeerless(csvText: string): ParseResult<CarrierCdrRow> {
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
    const term = normaliseTN(
      getField(row, headerMap, "terminating_phone_number", "terminating_number", "to_number"),
    );
    if (!term) {
      skippedNoTN++;
      continue;
    }

    const callDate = parseDate(
      getField(row, headerMap, "call_date", "call_start_time", "start_time", "date"),
    );
    if (!callDate) {
      skippedNoDate++;
      continue;
    }
    trackPeriod(period, callDate);

    const orig = normaliseTN(
      getField(row, headerMap, "originating_phone_number", "from_number", "calling_number"),
    );
    const cost = parseAmount(getField(row, headerMap, "billable_amount", "amount", "charge"));
    const duration = parseInteger(
      getField(row, headerMap, "billable_seconds", "duration", "duration_sec", "seconds"),
    );

    rows.push({
      carrier: "peerless",
      call_date: callDate,
      originating_tn: orig || null,
      terminating_tn: term,
      duration_sec: duration,
      carrier_cost: cost,
      raw: row,
    });
  }

  if (skippedNoTN > 0)
    warnings.push(`${skippedNoTN} rows skipped: no usable terminating_phone_number.`);
  if (skippedNoDate > 0) warnings.push(`${skippedNoDate} rows skipped: no usable call date.`);

  return {
    rows,
    warnings,
    periodStart: period.min,
    periodEnd: period.max,
  };
}
