"use client";

import { useMemo, useState } from "react";

const CARRIERS = ["bandwidth", "peerless", "inteliquent"] as const;
type Carrier = (typeof CARRIERS)[number];
type CarrierFilter = "all" | Carrier;

export type VoiceRow = {
  customer_id: string;
  carrier: string | null;
  total_revenue: number | string;
  total_cost: number | string;
  gross_profit: number | string;
  gross_margin: number | string;
  call_count: number;
  period_start: string | null;
  period_end: string | null;
};

const PAGE_SIZE = 50;

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

type SortKey =
  | "customer_id"
  | "carrier"
  | "total_revenue"
  | "total_cost"
  | "gross_profit"
  | "gross_margin";
type SortDir = "asc" | "desc";

export function VoiceClient({ rows }: { rows: VoiceRow[] }) {
  const [customerSearch, setCustomerSearch] = useState("");
  const [carrierFilter, setCarrierFilter] = useState<CarrierFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("gross_margin");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    return rows.filter((r) => {
      if (term && !r.customer_id.toLowerCase().includes(term)) return false;
      if (carrierFilter !== "all" && r.carrier !== carrierFilter) return false;
      if (dateFrom && r.period_end && r.period_end < dateFrom) return false;
      if (dateTo && r.period_start && r.period_start > dateTo) return false;
      return true;
    });
  }, [rows, customerSearch, carrierFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (sortKey === "customer_id" || sortKey === "carrier") {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      } else {
        cmp = (Number(av) || 0) - (Number(bv) || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Chart totals — sum across the current filter, per carrier.
  const carrierTotals = useMemo(() => {
    const totals: Record<Carrier, { revenue: number; cost: number }> = {
      bandwidth: { revenue: 0, cost: 0 },
      peerless: { revenue: 0, cost: 0 },
      inteliquent: { revenue: 0, cost: 0 },
    };
    for (const r of filtered) {
      if (r.carrier && (CARRIERS as readonly string[]).includes(r.carrier)) {
        const c = r.carrier as Carrier;
        totals[c].revenue += Number(r.total_revenue) || 0;
        totals[c].cost += Number(r.total_cost) || 0;
      }
    }
    return totals;
  }, [filtered]);

  const chartMax = Math.max(
    1,
    ...CARRIERS.flatMap((c) => [carrierTotals[c].revenue, carrierTotals[c].cost]),
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function reset() {
    setCustomerSearch("");
    setCarrierFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-card bg-white border border-border p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <input
          type="text"
          placeholder="Search customer ID"
          value={customerSearch}
          onChange={(e) => {
            setCustomerSearch(e.target.value);
            setPage(0);
          }}
          className="rounded-card border border-border px-3 py-2 text-sm bg-white"
        />
        <select
          value={carrierFilter}
          onChange={(e) => {
            setCarrierFilter(e.target.value as CarrierFilter);
            setPage(0);
          }}
          className="rounded-card border border-border px-3 py-2 text-sm bg-white"
        >
          <option value="all">All carriers</option>
          <option value="bandwidth">Bandwidth</option>
          <option value="peerless">Peerless</option>
          <option value="inteliquent">Inteliquent</option>
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

      {/* Chart */}
      <div className="rounded-card bg-white border border-border p-5">
        <h3 className="font-semibold text-navy">Revenue vs cost by carrier</h3>
        <p className="text-xs text-text-secondary mt-1">Within current filter</p>
        <div className="space-y-4 mt-4">
          {CARRIERS.map((c) => {
            const t = carrierTotals[c];
            return (
              <div key={c}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium text-navy capitalize">{c}</span>
                  <span className="text-text-secondary">
                    Revenue {usd(t.revenue)} · Cost {usd(t.cost)}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-3 rounded-pill bg-border-light overflow-hidden">
                    <div
                      className="h-full bg-orange"
                      style={{ width: `${(t.revenue / chartMax) * 100}%` }}
                    />
                  </div>
                  <div className="h-3 rounded-pill bg-border-light overflow-hidden">
                    <div
                      className="h-full bg-navy"
                      style={{ width: `${(t.cost / chartMax) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-text-secondary">
          <span><span className="inline-block w-3 h-2 rounded-pill bg-orange align-middle mr-1"></span>Revenue</span>
          <span><span className="inline-block w-3 h-2 rounded-pill bg-navy align-middle mr-1"></span>Cost</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-card bg-white border border-border p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold text-navy">Profitability rows</h3>
          <span className="text-xs text-text-secondary">
            {sorted.length.toLocaleString()} {sorted.length === 1 ? "row" : "rows"}
          </span>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary border-b border-border">
                <SortHeader k="customer_id" label="Customer" curKey={sortKey} curDir={sortDir} onClick={toggleSort} />
                <SortHeader k="carrier" label="Carrier" curKey={sortKey} curDir={sortDir} onClick={toggleSort} />
                <SortHeader k="total_revenue" label="Revenue" curKey={sortKey} curDir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader k="total_cost" label="Cost" curKey={sortKey} curDir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader k="gross_profit" label="GP" curKey={sortKey} curDir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader k="gross_margin" label="Margin" curKey={sortKey} curDir={sortDir} onClick={toggleSort} align="right" />
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
                    key={`${r.customer_id}-${r.carrier ?? "null"}-${i}`}
                    className="border-b border-border-light last:border-b-0"
                  >
                    <td className="py-2 font-mono text-xs">{r.customer_id}</td>
                    <td className="py-2 capitalize">{r.carrier ?? "—"}</td>
                    <td className="py-2 text-right">{usd(Number(r.total_revenue))}</td>
                    <td className="py-2 text-right">{usd(Number(r.total_cost))}</td>
                    <td className="py-2 text-right">{usd(Number(r.gross_profit))}</td>
                    <td className="py-2 text-right">{pct(Number(r.gross_margin))}</td>
                  </tr>
                ))
              )}
            </tbody>
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
