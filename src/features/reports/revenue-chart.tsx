"use client";

import * as React from "react";
import type { RevenueBucket, RevenueGranularity } from "@/lib/revenue-series";
import {
  formatChartAxisMoney,
  revenueSeriesCaption,
} from "@/lib/revenue-series";
import { formatMoney } from "@/lib/format-money";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 36, left: 48 };

export function RevenueChart({
  buckets,
  granularity,
  className,
}: {
  buckets: RevenueBucket[];
  granularity: RevenueGranularity;
  className?: string;
}) {
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const [width, setWidth] = React.useState(640);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 640);
    return () => ro.disconnect();
  }, []);

  const maxTotal = Math.max(...buckets.map((b) => b.total), 1);
  const plotW = width - PAD.left - PAD.right;
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const barGap = granularity === "day" ? 3 : 8;
  const barW = Math.max(
    4,
    (plotW - barGap * (buckets.length - 1)) / Math.max(buckets.length, 1),
  );

  const hovered = buckets.find((b) => b.key === hoveredKey) ?? null;
  const seriesTotal = buckets.reduce((s, b) => s + b.total, 0);
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxTotal / tickCount) * i),
  );

  const labelStep =
    granularity === "day" ? 5 : granularity === "month" ? 2 : 1;

  if (buckets.every((b) => b.total === 0)) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">
          No revenue in this period yet.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {formatMoney(seriesTotal)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Total · {revenueSeriesCaption(granularity)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: "var(--primary)" }}
              aria-hidden
            />
            POS sales
          </span>
          <span className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: "var(--highlight)" }}
              aria-hidden
            />
            Installments & pay later
          </span>
        </div>
      </div>

      <div className="relative">
        {hovered ? (
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
            role="status"
          >
            <p className="font-medium">{hovered.label}</p>
            <p className="mt-1 tabular-nums font-semibold">
              {formatMoney(hovered.total)}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Sales {formatMoney(hovered.salesAmount)} · Plans{" "}
              {formatMoney(hovered.planPaymentsAmount)}
            </p>
          </div>
        ) : null}

        <svg
          width={width}
          height={CHART_HEIGHT}
          className="overflow-visible"
          aria-label="Revenue chart"
        >
          {yTicks.map((tick) => {
            const y =
              PAD.top + plotH - (tick / maxTotal) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={width - PAD.right}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                  opacity={0.7}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {formatChartAxisMoney(tick)}
                </text>
              </g>
            );
          })}

          {buckets.map((bucket, i) => {
            const x = PAD.left + i * (barW + barGap);
            const salesH = (bucket.salesAmount / maxTotal) * plotH;
            const plansH = (bucket.planPaymentsAmount / maxTotal) * plotH;
            const baseY = PAD.top + plotH;
            const isHovered = hoveredKey === bucket.key;
            const showLabel = i % labelStep === 0 || i === buckets.length - 1;

            return (
              <g
                key={bucket.key}
                onMouseEnter={() => setHoveredKey(bucket.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={baseY - salesH - plansH}
                  width={barW}
                  height={salesH + plansH}
                  rx={3}
                  fill="transparent"
                />
                {salesH > 0 ? (
                  <rect
                    x={x}
                    y={baseY - salesH - plansH}
                    width={barW}
                    height={salesH}
                    rx={plansH > 0 ? 0 : 3}
                    fill="var(--primary)"
                    opacity={isHovered ? 1 : 0.88}
                  />
                ) : null}
                {plansH > 0 ? (
                  <rect
                    x={x}
                    y={baseY - plansH}
                    width={barW}
                    height={plansH}
                    rx={salesH > 0 ? 0 : 3}
                    fill="var(--highlight)"
                    opacity={isHovered ? 1 : 0.92}
                  />
                ) : null}
                {salesH + plansH === 0 ? (
                  <rect
                    x={x}
                    y={baseY - 2}
                    width={barW}
                    height={2}
                    rx={1}
                    fill="var(--border)"
                    opacity={0.5}
                  />
                ) : null}
                {showLabel ? (
                  <text
                    x={x + barW / 2}
                    y={CHART_HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px]"
                  >
                    {bucket.shortLabel}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
