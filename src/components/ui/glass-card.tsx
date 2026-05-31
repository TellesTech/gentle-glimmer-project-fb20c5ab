import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  badge?: React.ReactNode;
  /** Inline icon shown above the title (optional) */
  icon?: React.ReactNode;
}

/**
 * GlassCard — 3D glassmorphism card with concentric halo and tilt on hover.
 * All colors derive from the design system (`--primary`, `--card`, `--border`).
 */
const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, title, subtitle, footer, badge, icon, onClick, ...props }, ref) => {
    const interactive = typeof onClick === "function";

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!interactive) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        (onClick as any)(e);
      }
    };

    return (
      <div
        className="group relative h-[300px] w-full"
        style={{ perspective: "1000px" }}
      >
        <div
          ref={ref}
          role={interactive ? "button" : undefined}
          tabIndex={interactive ? 0 : undefined}
          onClick={onClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "relative h-full w-full overflow-hidden rounded-2xl border border-border/60",
            "bg-gradient-to-br from-card/90 to-card/60 backdrop-blur-xl",
            "shadow-[0_18px_50px_-20px_hsl(var(--primary)/0.45)]",
            "transition-transform duration-500 ease-out will-change-transform",
            interactive && "cursor-pointer hover:shadow-[0_30px_70px_-20px_hsl(var(--primary)/0.6)]",
            "focus:outline-none focus:ring-2 focus:ring-primary/60",
            className
          )}
          style={{
            transformStyle: "preserve-3d",
          }}
          {...props}
        >
          {/* top sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-70"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--primary) / 0.18) 0%, transparent 100%)",
            }}
          />

          {/* concentric halo (3D feel) */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {[
              { size: 220, blur: 30, opacity: 0.18 },
              { size: 170, blur: 22, opacity: 0.22 },
              { size: 120, blur: 16, opacity: 0.28 },
              { size: 80, blur: 10, opacity: 0.4 },
            ].map((c, i) => (
              <div
                key={i}
                className="absolute rounded-full transition-all duration-700 ease-out group-hover:scale-110"
                style={{
                  width: c.size,
                  height: c.size,
                  background: `radial-gradient(circle, hsl(var(--primary) / ${c.opacity}) 0%, transparent 70%)`,
                  filter: `blur(${c.blur}px)`,
                  transform: `translateZ(${i * 12}px)`,
                }}
              />
            ))}
            {/* inner glossy disc */}
            <div
              className="absolute h-16 w-16 rounded-full border border-white/30 transition-transform duration-700 group-hover:scale-110"
              style={{
                background:
                  "radial-gradient(circle at 35% 30%, hsl(var(--background)) 0%, hsl(var(--primary) / 0.85) 70%)",
                boxShadow:
                  "inset 0 -6px 14px hsl(var(--primary) / 0.5), 0 8px 24px hsl(var(--primary) / 0.4)",
                transform: "translateZ(60px)",
              }}
            />
          </div>

          {/* badge top-right */}
          {badge && (
            <div className="absolute right-3 top-3 z-10" onClick={(e) => e.stopPropagation()}>
              {badge}
            </div>
          )}

          {/* icon top-left */}
          {icon && (
            <div className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary backdrop-blur">
              {icon}
            </div>
          )}

          {/* content */}
          <div className="relative z-10 flex h-full flex-col justify-end gap-1 p-5">
            <h3 className="text-lg font-semibold leading-tight text-foreground">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {footer && (
              <p className="mt-2 text-xs font-medium text-muted-foreground/90">
                {footer}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export default GlassCard;
