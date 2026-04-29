import { getUploadStatus } from "@/app/actions/upload";
import { Logo } from "@/components/logo";
import { UploadClient } from "./upload-client";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const status = await getUploadStatus();

  return (
    <main className="min-h-screen px-6 py-10 bg-cream">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-navy">Upload source data</h1>
            <p className="mt-2 text-text-secondary max-w-2xl">
              Drop in carrier and billing CSV exports. For matching to work, all six files
              should cover the same accounting period — the page will warn you if loaded
              files have non-overlapping date ranges.
            </p>
          </div>
          <Logo />
        </header>

        <UploadClient initialStatus={status} />
      </div>
    </main>
  );
}
