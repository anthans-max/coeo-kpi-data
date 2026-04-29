import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/kpi-card";
import { MatchRateBar } from "@/components/match-rate-bar";
import { DataQualityBanner } from "@/components/data-quality-banner";

export const dynamic = "force-dynamic";

const CARRIERS = ["bandwidth", "peerless", "inteliquent"] as const;
type Carrier = (typeof CARRIERS)[number];

type VoiceRow = {
  customer_id: string;
  total_revenue: number | string;
  total_cost: number | string;
  gross_profit: number | string;
  gross_margin: number | string;
  call_count: number;
};

type CircuitRow = {
  customer_name: string | null;
  billed_amount: number | string;
};

type ReconRow = {
  carrier: string;
  total_cdrs: number;
  matched_cdrs: number;
  unmatched_cdrs: number;
  match_rate: number | string | null;
  zero_cost_rows: number;
  notes: string | null;
};

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

const usdPrecise = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);

const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);

export default async function Dashboard() {
  const supabase = await createClient();

  const [voiceRes, circuitRes, reconRes] = await Promise.all([
    supabase
      .from("cogs_voice_profitability")
      .select(
        "customer_id, total_revenue, total_cost, gross_profit, gross_margin, call_count",
      ),
    supabase.from("cogs_circuit_cost").select("customer_name, billed_amount"),
    supabase
      .from("cogs_reconciliation_log")
      .select(
        "carrier, total_cdrs, matched_cdrs, unmatched_cdrs, match_rate, zero_cost_rows, notes",
      ),
  ]);

  const voiceRows = (voiceRes.data ?? []) as VoiceRow[];
  const circuitRows = (circuitRes.data ?? []) as CircuitRow[];
  const reconRows = (reconRes.data ?? []) as ReconRow[];

  if (reconRows.length === 0) {
    return (
      <main className="min-h-screen px-6 py-10 bg-cream">
        <div className="max-w-6xl mx-auto">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold text-navy">Coeo COGS dashboard</h1>
          </header>
          <div className="rounded-card bg-white border border-border p-8 text-center">
            <h2 className="text-xl font-semibold text-navy">No data yet</h2>
            <p className="mt-2 text-text-secondary">
              Upload all six source files and run compute to populate the dashboard.
            </p>
            <Link
              href="/upload"
              className="inline-block mt-6 rounded-pill bg-orange px-5 py-2 text-white text-sm font-medium hover:opacity-90"
            >
              Go to upload
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // KPIs
  const totalVoiceRevenue = voiceRows.reduce(
    (s, r) => s + (Number(r.total_revenue) || 0),
    0,
  );
  const totalVoiceCost = voiceRows.reduce(
    (s, r) => s + (Number(r.total_cost) || 0),
    0,
  );
  const totalCircuitCost = circuitRows.reduce(
    (s, r) => s + (Number(r.billed_amount) || 0),
    0,
  );
  const totalCogs = totalVoiceCost + totalCircuitCost;
  const voiceGp = totalVoiceRevenue - totalVoiceCost;
  const voiceMargin = totalVoiceRevenue > 0 ? voiceGp / totalVoiceRevenue : null;

  const totalMatched = reconRows.reduce((s, r) => s + r.matched_cdrs, 0);
  const totalCdrs = reconRows.reduce((s, r) => s + r.total_cdrs, 0);
  const overallMatchRate = totalCdrs > 0 ? totalMatched / totalCdrs : null;

  // Top 20 voice profitability rows by margin (revenue > 0 to make the sort meaningful).
  const voiceTop = voiceRows
    .filter((r) => Number(r.total_revenue) > 0)
    .sort((a, b) => Number(b.gross_margin) - Number(a.gross_margin))
    .slice(0, 20);

  // Top 15 circuits, grouped by customer.
  const circuitGroups = new Map<string, number>();
  for (const r of circuitRows) {
    const name = r.customer_name ?? "(unknown)";
    circuitGroups.set(
      name,
      (circuitGroups.get(name) ?? 0) + (Number(r.billed_amount) || 0),
    );
  }
  const circuitTop = [...circuitGroups.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const reconByCarrier: Record<Carrier, ReconRow | undefined> = {
    bandwidth: reconRows.find((r) => r.carrier === "bandwidth"),
    peerless: reconRows.find((r) => r.carrier === "peerless"),
    inteliquent: reconRows.find((r) => r.carrier === "inteliquent"),
  };

  return (
    <main className="min-h-screen px-6 py-10 bg-cream">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-navy">Coeo COGS dashboard</h1>
            <p className="text-text-secondary text-sm mt-1">
              Voice profitability and circuit COGS for the loaded period.
            </p>
          </div>
          <Link
            href="/upload"
            className="text-sm text-navy underline hover:no-underline"
          >
            Manage uploads
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            label="Total revenue"
            value={usd(totalVoiceRevenue)}
            sublabel="Voice CDR (Rev.IO)"
          />
          <KpiCard
            label="Total COGS"
            value={usd(totalCogs)}
            sublabel={`Voice ${usd(totalVoiceCost)} · Circuit ${usd(totalCircuitCost)}`}
          />
          <KpiCard
            label="Voice gross profit"
            value={usd(voiceGp)}
            sublabel={
              voiceMargin === null
                ? "—"
                : `${pct(voiceMargin)} margin · circuits not included`
            }
          />
          <KpiCard
            label="CDR match rate"
            value={pct(overallMatchRate)}
            sublabel={`${totalMatched.toLocaleString()} / ${totalCdrs.toLocaleString()} matched`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-card bg-white border border-border p-5">
            <h3 className="font-semibold text-navy">Voice profitability by customer</h3>
            <p className="text-xs text-text-secondary mt-1">
              Top 20 by margin · sorted descending
            </p>
            {overallMatchRate !== null && overallMatchRate < 0.05 && (
              <div className="mt-3 rounded-card border border-orange/40 bg-orange/10 p-3 text-xs text-text-primary">
                Margin figures unreliable — carrier CDR matching at {pct(overallMatchRate)}. Load CDR and inventory files covering the same period to get accurate margins.
              </div>
            )}
            {voiceTop.length === 0 ? (
              <div className="text-sm text-text-secondary mt-4 p-4 rounded-card bg-cream/50">
                No matched customers. The TN-to-customer join produced zero matches in the
                loaded data — likely because the loaded inventory and CDR files cover
                different customers.
              </div>
            ) : (
              <table className="w-full mt-4 text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-secondary border-b border-border">
                    <th className="py-2 font-medium">Customer</th>
                    <th className="py-2 font-medium text-right">Revenue</th>
                    <th className="py-2 font-medium text-right">Cost</th>
                    <th className="py-2 font-medium text-right">GP</th>
                    <th className="py-2 font-medium text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {voiceTop.map((r) => (
                    <tr
                      key={r.customer_id}
                      className="border-b border-border-light last:border-b-0"
                    >
                      <td className="py-2 font-mono text-xs">{r.customer_id}</td>
                      <td className="py-2 text-right">
                        {usd(Number(r.total_revenue))}
                      </td>
                      <td className="py-2 text-right">{usd(Number(r.total_cost))}</td>
                      <td className="py-2 text-right">
                        {usd(Number(r.gross_profit))}
                      </td>
                      <td className="py-2 text-right">
                        {pct(Number(r.gross_margin))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-card bg-white border border-border p-5">
            <h3 className="font-semibold text-navy">Circuit COGS by customer</h3>
            <p className="text-xs text-text-secondary mt-1">
              Top 15 by carrier cost · revenue mapping not yet implemented
            </p>
            {circuitTop.length === 0 ? (
              <div className="text-sm text-text-secondary mt-4">No circuit data loaded.</div>
            ) : (
              <table className="w-full mt-4 text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-secondary border-b border-border">
                    <th className="py-2 font-medium">Customer</th>
                    <th className="py-2 font-medium text-right">Carrier cost</th>
                  </tr>
                </thead>
                <tbody>
                  {circuitTop.map(([name, total]) => (
                    <tr
                      key={name}
                      className="border-b border-border-light last:border-b-0"
                    >
                      <td className="py-2">{name}</td>
                      <td className="py-2 text-right">{usdPrecise(total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-card bg-white border border-border p-5 space-y-4">
          <h3 className="font-semibold text-navy">Data quality</h3>
          <div className="space-y-3">
            {CARRIERS.map((c) => {
              const r = reconByCarrier[c];
              return (
                <MatchRateBar
                  key={c}
                  carrier={c}
                  matched={r?.matched_cdrs ?? 0}
                  total={r?.total_cdrs ?? 0}
                />
              );
            })}
          </div>

          {(overallMatchRate !== null && overallMatchRate < 0.5) && (
            <DataQualityBanner
              tone="warning"
              title="Low overall match rate"
              body="Most CDRs are unmatched. Confirm the inventory and CDR files cover the same customers and accounting period."
            />
          )}

          <div className="space-y-2">
            {CARRIERS.map((c) => {
              const r = reconByCarrier[c];
              if (!r?.notes) return null;
              return (
                <DataQualityBanner
                  key={`note-${c}`}
                  tone="info"
                  title={`${c.charAt(0).toUpperCase()}${c.slice(1)} note`}
                  body={r.notes}
                />
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
