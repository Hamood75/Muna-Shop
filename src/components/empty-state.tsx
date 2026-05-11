import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PackageOpen } from "lucide-react";

export function EmptyState({
  icon: Icon = PackageOpen,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/90 bg-gradient-to-b from-muted/50 to-muted/25 px-8 py-16 text-center shadow-inner dark:from-muted/30 dark:to-muted/10">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm dark:bg-primary/18">
        <Icon className="size-7" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children ? <div className="mt-8">{children}</div> : null}
    </div>
  );
}
