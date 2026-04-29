import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MatchRateBar } from "@/components/match-rate-bar";
import { DataQualityBanner } from "@/components/data-quality-banner";

export const dynamic = "force-dynamic";

const CARRIERS = ["bandwidth", "peerless", "inteliquent"] as const;
type Carrier = (typeof CARRIERS)[number];

type ReconRow = {
  id: string;
  computed_at: string;
  carrier: string;
  total_cdrs: number;
  matched_cdrs: number;
  unmatched_cdrs: number;
  match_rate: number | string | null;
  zero_cost_rows: number;
  notes: string | null;
};

type Run = {
  computedAt: string;
  rows: Record<Carrier, ReconRow | undefined>;
};

const pct = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);

export default async function ReconciliationPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cogs_reconciliation_log")
    .select(
      "id, computed_at, carrier, total_cdrs, matched_cdrs, unmatched_cdrs, match_rate, zero_cost_rows, notes",
    )
    .order("computed_at", { ascending: false });

  const rows = (data ?? []) as ReconRow[];

  if (rows.length === 0) {
    return (
      <main className="min-h-screen px-6 py-10 bg-cream">
        <div className="max-w-6xl mx-auto space-y-6">
          <header>
            <h1 className="text-3xl font-semibold text-navy">Reconciliation</h1>
            <p className="text-text-secondary text-sm mt-1">
              Per-run match rates and data quality flags.
            </p>
          </header>
          <div className="rounded-card bg-white border border-border p-8 text-center">
            <h2 className="text-xl font-semibold text-navy">No runs yet</h2>
            <p className="mt-2 text-text-secondary">
              Run compute on the upload page to record a reconciliation entry.
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

  // Group rows by computed_at into runs.
  const runMap = new Map<string, Run>();
  for (const r of rows) {
    const run = runMap.get(r.computed_at) ?? {
      computedAt: r.computed_at,
      rows: { bandwidth: undefined, peerless: undefined, inteliquent: undefined },
    };
    if ((CARRIERS as readonly string[]).includes(r.carrier)) {
      run.rows[r.carrier as Carrier] = r;
    }
    runMap.set(r.computed_at, run);
  }
  const runs = [...runMap.values()].sort((a, b) =>
    a.computedAt < b.computedAt ? 1 : -1,
  );

  return (
    <main className="min-h-screen px-6 py-10 bg-cream">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-navy">Reconciliation</h1>
          <p className="text-text-secondary text-sm mt-1">
            {runs.length.toLocaleString()} {runs.length === 1 ? "run" : "runs"} recorded.
            Newest first.
          </p>
        </header>

        {runs.map((run, idx) => (
          <RunCard key={run.computedAt} run={run} latest={idx === 0} />
        ))}
      </div>
    </main>
  );
}

function RunCard({ run, latest }: { run: Run; latest: boolean }) {
  const ts = new Date(run.computedAt);
  const formatted = ts.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const carrierRows = CARRIERS.map((c) => run.rows[c]);
  const totalAcross = carrierRows.reduce((s, r) => s + (r?.total_cdrs ?? 0), 0);
  const matchedAcross = carrierRows.reduce((s, r) => s + (r?.matched_cdrs ?? 0), 0);
  const overall = totalAcross > 0 ? matchedAcross / totalAcross : null;

  return (
    <div className="rounded-card bg-white border border-border p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="font-semibold text-navy">{formatted}</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {latest ? "Latest run · " : ""}
            {matchedAcross.toLocaleString()} / {totalAcross.toLocaleString()} CDRs matched
            ({pct(overall)} overall)
          </p>
        </div>
        {latest && (
          <span className="text-xs px-2 py-0.5 rounded-pill bg-cream text-navy">latest</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-secondary border-b border-border">
              <th className="py-2 font-medium">Carrier</th>
              <th className="py-2 font-medium text-right">Total CDRs</th>
              <th className="py-2 font-medium text-right">Matched</th>
              <th className="py-2 font-medium text-right">Unmatched</th>
              <th className="py-2 font-medium text-right">Match rate</th>
              <th className="py-2 font-medium text-right">Zero-cost</th>
            </tr>
          </thead>
          <tbody>
            {CARRIERS.map((c) => {
              const r = run.rows[c];
              return (
                <tr key={c} className="border-b border-border-light last:border-b-0">
                  <td className="py-2 capitalize">{c}</td>
                  <td className="py-2 text-right">
                    {(r?.total_cdrs ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    {(r?.matched_cdrs ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    {(r?.unmatched_cdrs ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    {pct(r?.match_rate == null ? null : Number(r.match_rate))}
                  </td>
                  <td className="py-2 text-right">
                    {(r?.zero_cost_rows ?? 0).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        {CARRIERS.map((c) => {
          const r = run.rows[c];
          return (
            <MatchRateBar
              key={`bar-${c}`}
              carrier={c}
              matched={r?.matched_cdrs ?? 0}
              total={r?.total_cdrs ?? 0}
            />
          );
        })}
      </div>

      <div className="space-y-2">
        {CARRIERS.map((c) => {
          const r = run.rows[c];
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
  );
}
