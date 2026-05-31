import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";

interface WaveSparklineProps {
  data: number[];
  color?: string;
  className?: string;
  height?: number;
  strokeWidth?: number;
}

/**
 * Lightweight area sparkline with smooth (Catmull-Rom) curve and gradient fill.
 * Renders inline SVG — no external chart deps.
 */
export function WaveSparkline({
  data,
  color = "hsl(var(--primary))",
  className,
  height = 64,
  strokeWidth = 2,
}: WaveSparklineProps) {
  const gradientId = useId();
  const width = 200; // viewBox width — scales via preserveAspectRatio
  const points = useMemo(() => {
    if (!data.length) return [];
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = width / Math.max(data.length - 1, 1);
    return data.map((v, i) => ({
      x: i * stepX,
      y: height - ((v - min) / range) * (height - strokeWidth * 2) - strokeWidth,
    }));
  }, [data, height, strokeWidth]);

  const { linePath, areaPath } = useMemo(() => {
    if (points.length < 2) return { linePath: "", areaPath: "" };
    // Smooth Catmull-Rom -> Bezier
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    const area = `${d} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;
    return { linePath: d, areaPath: area };
  }, [points, height]);

  if (points.length < 2) {
    return (
      <div
        className={cn("flex items-end justify-center text-xs text-muted-foreground/50", className)}
        style={{ height }}
      >
        sem dados
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full overflow-visible", className)}
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
