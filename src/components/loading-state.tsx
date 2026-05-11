export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-border/90 bg-card/80 px-6 py-12 text-muted-foreground shadow-md backdrop-blur-sm dark:bg-card/60"
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <div className="motion-safe:absolute motion-safe:inset-0 motion-safe:animate-ping rounded-full bg-primary/20 [animation-duration:1.5s]" />
        <div className="relative size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
