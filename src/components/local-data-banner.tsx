/**
 * Shown under the header — purely informational for the desktop build.
 */
export function LocalDataBanner() {
  return (
    <div
      role="status"
      className="border-b border-border/80 bg-muted/50 px-4 py-2 text-center text-sm text-muted-foreground"
    >
      Local mode — inventory and sales are stored only in the SQLite database on this
      computer. No account or network is required.
    </div>
  );
}
