"use client";

import { useMemo, useState } from "react";

export type CircuitRow = {
  circuit_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  customer_name: string | null;
  product_desc: string | null;
  state: string | null;
  billed_amount: number | string;
  mrc_from: string | null;
  mrc_thru: string | null;
};

const PAGE_SIZE = 50;

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

type SortKey =
  | "customer_name"
  | "circuit_id"
  | "product_desc"
  | "state"
  | "invoice_date"
  | "billed_amount";
type SortDir = "asc" | "desc";

export function CircuitsClient({ rows }: { rows: CircuitRow[] }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("billed_amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const states = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.state) set.add(r.state);
    }
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !(r.customer_name ?? "").toLowerCase().includes(term)) return false;
      if (stateFilter !== "all" && r.state !== stateFilter) return false;
      if (dateFrom && r.invoice_date && r.invoice_date < dateFrom) return false;
      if (dateTo && r.invoice_date && r.invoice_date > dateTo) return false;
      return true;
    });
  }, [rows, customerSearch, stateFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (sortKey === "billed_amount") {
        cmp = (Number(av) || 0) - (Number(bv) || 0);
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const subtotal = useMemo(
    () => filtered.reduce((s, r) => s + (Number(r.billed_amount) || 0), 0),
    [filtered],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "billed_amount" ? "desc" : "asc");
    }
    setPage(0);
  }

  function reset() {
    setCustomerSearch("");
    setStateFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-card bg-white border border-border p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          type="text"
          placeholder="Search customer name"
          value={customerSearch}
          onChange={(e) => {
            setCustomerSearch(e.target.value);
            setPage(0);
          }}
          className="rounded-card border border-border px-3 py-2 text-sm bg-white"
        />
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(0);
          }}
          className="rounded-card border border-border px-3 py-2 text-sm bg-white"
        >
          <option value="all">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(0);
          }}
          className="rounded-card border border-border px-3 py-2 text-sm bg-white"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(0);
          }}
          className="rounded-card border border-border px-3 py-2 text-sm bg-white"
        />
        <button
          onClick={reset}
          className="rounded-pill bg-cream text-navy text-sm py-2 px-4 hover:bg-border-light"
        >
          Reset
        </button>
      </div>

      <div className="rounded-card bg-white border border-border p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold text-navy">Circuit detail</h3>
          <span className="text-xs text-text-secondary">
            {sorted.length.toLocaleString()} {sorted.length === 1 ? "row" : "rows"}
          </span>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary border-b border-border">
                <SortHeader k="customer_name" label="Customer" curKey={sortKey} curDir={sortDir} onClick={toggleSort} />
                <SortHeader k="circuit_id" label="Circuit" curKey={sortKey} curDir={sortDir} onClick={toggleSort} />
                <SortHeader k="product_desc" label="Product" curKey={sortKey} curDir={sortDir} onClick={toggleSort} />
                <SortHeader k="state" label="State" curKey={sortKey} curDir={sortDir} onClick={toggleSort} />
                <SortHeader k="invoice_date" label="Invoice date" curKey={sortKey} curDir={sortDir} onClick={toggleSort} />
                <SortHeader k="billed_amount" label="Cost" curKey={sortKey} curDir={sortDir} onClick={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-text-secondary">
                    No rows match the current filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr
                    key={`${r.circuit_id ?? "x"}-${i}`}
                    className="border-b border-border-light last:border-b-0"
                  >
                    <td className="py-2">{r.customer_name ?? "—"}</td>
                    <td className="py-2 font-mono text-xs">{r.circuit_id ?? "—"}</td>
                    <td className="py-2">{r.product_desc ?? "—"}</td>
                    <td className="py-2">{r.state ?? "—"}</td>
                    <td className="py-2">{r.invoice_date ?? "—"}</td>
                    <td className="py-2 text-right">{usd(Number(r.billed_amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-navy/20">
                <td colSpan={5} className="py-3 font-medium text-navy">
                  Subtotal (filtered)
                </td>
                <td className="py-3 text-right font-medium text-navy">{usd(subtotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm">
            <button
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="rounded-pill bg-cream text-navy px-4 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-text-secondary text-xs">
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-pill bg-cream text-navy px-4 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SortHeader({
  k,
  label,
  curKey,
  curDir,
  onClick,
  align,
}: {
  k: SortKey;
  label: string;
  curKey: SortKey;
  curDir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const isActive = curKey === k;
  return (
    <th className={`py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onClick(k)}
        className={`hover:text-navy transition-colors ${isActive ? "text-navy" : ""}`}
      >
        {label}
        {isActive ? (curDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}
