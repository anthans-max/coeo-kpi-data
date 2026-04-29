// Normalisation helpers shared across all CSV parsers.

export function normaliseTN(raw: string | null | undefined): string {
  if (raw == null) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "1") return digits.slice(1);
  if (digits.length === 10) return digits;
  return "";
}

// Returns ISO yyyy-mm-dd, or null if unparseable.
// Handles: "2024-03-15", "3/15/2024", "03/15/2024", "2024-03-15T12:34:56", "Mar 15, 2024".
export function parseDate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // ISO-prefixed: yyyy-mm-dd or yyyy-mm-ddT...
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // US: m/d/yyyy or mm/dd/yyyy (optionally with time after)
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    const mm = us[1].padStart(2, "0");
    const dd = us[2].padStart(2, "0");
    return `${us[3]}-${mm}-${dd}`;
  }

  // Fallback: hand to Date and re-emit yyyy-mm-dd
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  return null;
}

// Strips $, commas, parens (negative); returns 0 for blank/invalid.
export function parseAmount(raw: string | null | undefined): number {
  if (raw == null) return 0;
  let s = String(raw).trim();
  if (!s) return 0;
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  const n = Number(s);
  if (!isFinite(n)) return 0;
  return negative ? -n : n;
}

export function parseInteger(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  if (!isFinite(n)) return null;
  return Math.trunc(n);
}

// Build a case-insensitive header → original-key lookup so parsers can read
// rows by canonical name regardless of vendor capitalisation/whitespace.
export function buildHeaderMap(headers: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const h of headers) {
    if (typeof h === "string") {
      map.set(h.trim().toLowerCase(), h);
    }
  }
  return map;
}

export function getField(
  row: Record<string, unknown>,
  headerMap: Map<string, string>,
  ...candidates: string[]
): string | undefined {
  for (const c of candidates) {
    const original = headerMap.get(c.trim().toLowerCase());
    if (original !== undefined) {
      const v = row[original];
      if (v != null && String(v).trim() !== "") return String(v);
    }
  }
  return undefined;
}

export function trackPeriod(
  state: { min: string | null; max: string | null },
  date: string | null,
): void {
  if (!date) return;
  if (!state.min || date < state.min) state.min = date;
  if (!state.max || date > state.max) state.max = date;
}
