import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VoiceClient, type VoiceRow } from "./voice-client";

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cogs_voice_profitability")
    .select(
      "customer_id, carrier, total_revenue, total_cost, gross_profit, gross_margin, call_count, period_start, period_end",
    );

  const rows = (data ?? []) as VoiceRow[];

  return (
    <main className="min-h-screen px-6 py-10 bg-cream">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-navy">Voice profitability</h1>
          <p className="text-text-secondary text-sm mt-1">
            Per-(customer, carrier) rows from the latest compute run. Revenue is allocated
            proportionally by cost share; rows with carrier &quot;—&quot; hold revenue for
            customers with no matched carrier cost.
          </p>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-card bg-white border border-border p-8 text-center">
            <h2 className="text-xl font-semibold text-navy">No data yet</h2>
            <p className="mt-2 text-text-secondary">
              Run compute on the upload page to populate this view.
            </p>
            <Link
              href="/upload"
              className="inline-block mt-6 rounded-pill bg-orange px-5 py-2 text-white text-sm font-medium hover:opacity-90"
            >
              Go to upload
            </Link>
          </div>
        ) : (
          <VoiceClient rows={rows} />
        )}
      </div>
    </main>
  );
}
