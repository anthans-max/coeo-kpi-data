type Props = {
  carrier: string;
  matched: number;
  total: number;
};

export function MatchRateBar({ carrier, matched, total }: Props) {
  const rate = total > 0 ? matched / total : null;
  const pct = rate === null ? 0 : Math.round(rate * 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-navy capitalize">{carrier}</span>
        <span className="text-text-secondary">
          {rate === null
            ? "no data"
            : `${matched.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`}
        </span>
      </div>
      <div className="h-2 rounded-pill bg-border-light overflow-hidden">
        <div
          className={
            rate === null ? "h-full bg-border" : "h-full bg-orange transition-all"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
