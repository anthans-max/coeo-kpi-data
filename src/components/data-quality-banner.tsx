type Props = {
  tone: "warning" | "info";
  title: string;
  body: string;
};

export function DataQualityBanner({ tone, title, body }: Props) {
  const cls =
    tone === "warning"
      ? "border-orange/40 bg-orange/10"
      : "border-navy/20 bg-navy/5";
  return (
    <div className={`rounded-card border p-4 text-sm ${cls}`}>
      <div className="font-semibold text-navy">{title}</div>
      <div className="text-text-primary mt-1">{body}</div>
    </div>
  );
}
