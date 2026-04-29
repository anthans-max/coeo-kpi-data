import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageFooter } from "@/components/page-footer";
import { CircuitsClient, type CircuitRow } from "./circuits-client";

const CIRCUITS_SOURCES =
  "RazorFlow Circuit Detail (carrier cost) · Circuit revenue not yet implemented — requires Salesforce Circuit and RazorFlow ProvInventory (Phase 2)";

export const dynamic = "force-dynamic";

export default async function CircuitsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cogs_circuit_cost")
    .select(
      "circuit_id, invoice_number, invoice_date, customer_name, product_desc, state, billed_amount, mrc_from, mrc_thru",
    );

  const rows = (data ?? []) as CircuitRow[];

  return (
    <main className="min-h-screen px-6 py-10 bg-cream">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-semibold text-navy">Circuit costs</h1>
          <p className="text-text-secondary text-sm mt-1">
            RazorFlow circuit detail. Revenue mapping is not yet implemented — costs only.
          </p>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-card bg-white border border-border p-8 text-center">
            <h2 className="text-xl font-semibold text-navy">No data yet</h2>
            <p className="mt-2 text-text-secondary">
              Upload a RazorFlow Circuit Detail CSV on the upload page.
            </p>
            <Link
              href="/upload"
              className="inline-block mt-6 rounded-pill bg-orange px-5 py-2 text-white text-sm font-medium hover:opacity-90"
            >
              Go to upload
            </Link>
          </div>
        ) : (
          <CircuitsClient rows={rows} />
        )}

        <PageFooter sources={CIRCUITS_SOURCES} />
      </div>
    </main>
  );
}
