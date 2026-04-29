import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-semibold text-navy">Coeo COGS</h1>
        <p className="text-text-secondary">
          COGS &amp; profitability mapping. The dashboard ships in Session 2 — start by uploading
          source CSVs.
        </p>
        <Link
          href="/upload"
          className="inline-block rounded-pill bg-orange px-6 py-3 text-white font-medium hover:opacity-90 transition-opacity"
        >
          Go to upload
        </Link>
      </div>
    </main>
  );
}
