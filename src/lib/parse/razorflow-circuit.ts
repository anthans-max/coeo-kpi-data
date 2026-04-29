import Papa from "papaparse";
import {
  buildHeaderMap,
  getField,
  parseAmount,
  parseDate,
  trackPeriod,
} from "../normalise";
import type { CircuitCostRow, ParseResult } from "../types";

// RazorFlow CircuitDetail — circuit cost (no revenue join in v1).
//   Circuit ID:     `cid_condensed_ec_circuit`
//   Customer:       `cid_customer_name_z` (preferred) or `_a` (fallback)
//   Cost:           `cid_total_billed_amount`
export function parseRazorflowCircuit(csvText: string): ParseResult<CircuitCostRow> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const warnings: string[] = [];
  for (const err of parsed.errors.slice(0, 5)) {
    warnings.push(`Row ${err.row}: ${err.message}`);
  }

  const rows: CircuitCostRow[] = [];
  const period = { min: null as string | null, max: null as string | null };
  const headerMap = buildHeaderMap(parsed.meta.fields ?? []);

  for (const row of parsed.data) {
    const circuitId = getField(row, headerMap, "cid_condensed_ec_circuit", "circuit_id");
    const customerName =
      getField(row, headerMap, "cid_customer_name_z") ??
      getField(row, headerMap, "cid_customer_name_a") ??
      getField(row, headerMap, "customer_name");

    const invoiceNumber = getField(row, headerMap, "cid_invoice_number", "invoice_number");
    const invoiceDate = parseDate(
      getField(row, headerMap, "cid_invoice_date", "invoice_date"),
    );
    trackPeriod(period, invoiceDate);

    const productDesc = getField(row, headerMap, "cid_product_desc", "product_desc");
    const state = getField(row, headerMap, "cid_state", "state");
    const billed = parseAmount(
      getField(row, headerMap, "cid_total_billed_amount", "total_billed_amount", "billed_amount"),
    );
    const mrcFrom = parseDate(getField(row, headerMap, "cid_mrc_from", "mrc_from"));
    const mrcThru = parseDate(getField(row, headerMap, "cid_mrc_thru", "mrc_thru"));

    rows.push({
      circuit_id: circuitId ?? null,
      invoice_number: invoiceNumber ?? null,
      invoice_date: invoiceDate,
      customer_name: customerName ?? null,
      product_desc: productDesc ?? null,
      state: state ?? null,
      billed_amount: billed,
      mrc_from: mrcFrom,
      mrc_thru: mrcThru,
      raw: row,
    });
  }

  return {
    rows,
    warnings,
    periodStart: period.min,
    periodEnd: period.max,
  };
}
