type Props = {
  sources: string;
};

export function PageFooter({ sources }: Props) {
  return (
    <footer className="mt-12 pt-6 border-t border-border">
      <p className="text-xs text-text-secondary">
        <span className="font-medium">Sources:</span> {sources}
      </p>
    </footer>
  );
}
