type Props = {
  label: string;
  value: string;
  sublabel?: string;
};

export function KpiCard({ label, value, sublabel }: Props) {
  return (
    <div className="rounded-card bg-white border border-border p-5">
      <div className="text-xs uppercase tracking-wide text-text-secondary">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-navy">{value}</div>
      {sublabel && (
        <div className="mt-1 text-xs text-text-muted">{sublabel}</div>
      )}
    </div>
  );
}
