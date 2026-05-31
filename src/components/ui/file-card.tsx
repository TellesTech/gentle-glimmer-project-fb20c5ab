import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FileFormat = "pdf" | "doc" | "xls" | "img" | "txt" | "csv" | "json" | "code";

interface FileCardProps {
  format?: FileFormat;
  title: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
  className?: string;
}

// Solid colored pill with white text in both themes.
const labelColorMap: Record<FileFormat, string> = {
  pdf:  "bg-red-500 text-white border-red-600/40",
  doc:  "bg-blue-500 text-white border-blue-600/40",
  xls:  "bg-emerald-500 text-white border-emerald-600/40",
  img:  "bg-pink-500 text-white border-pink-600/40",
  txt:  "bg-gray-500 text-white border-gray-600/40",
  csv:  "bg-teal-500 text-white border-teal-600/40",
  json: "bg-yellow-500 text-white border-yellow-600/40",
  code: "bg-orange-500 text-white border-orange-600/40",
};

const labelTextMap: Record<FileFormat, string> = {
  pdf: "PDF",
  doc: "DOC",
  xls: "XLS",
  img: "IMG",
  txt: "TXT",
  csv: "CSV",
  json: "JSON",
  code: "CODE",
};

export function FileCard({
  format = "pdf",
  title,
  subtitle,
  footer,
  badge,
  onClick,
  className,
}: FileCardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative w-full max-w-[180px] mx-auto",
        "aspect-[3/4] rounded-xl overflow-hidden",
        "bg-card border border-border shadow-md",
        "transition-all duration-300 ease-out",
        onClick &&
          "cursor-pointer hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary/40",
        className
      )}
    >
      {/* Status badge top-right */}
      {badge && <div className="absolute top-2 right-2 z-10">{badge}</div>}

      {/* Stylized text lines (top portion) */}
      <div className="absolute inset-x-0 top-0 px-3.5 pt-5 flex flex-col gap-1.5">
        <div className="h-1 w-3/4 rounded-full bg-muted-foreground/30" />
        <div className="h-1 w-2/3 rounded-full bg-muted-foreground/25" />
        <div className="h-1 w-5/6 rounded-full bg-muted-foreground/25" />
        <div className="h-1 w-1/2 rounded-full bg-muted-foreground/25" />
        <div className="h-1 w-3/5 rounded-full bg-muted-foreground/20" />
      </div>

      {/* Format pill bottom-right (glassmorphism) */}
      <span
        className={cn(
          "absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider z-10",
          "border shadow-md",
          labelColorMap[format]
        )}
      >
        {labelTextMap[format]}
      </span>

      {/* Title + meta INSIDE the document, bottom-left */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pr-14 space-y-0.5">
        <div className="font-semibold text-xs text-card-foreground line-clamp-1">{title}</div>
        {subtitle && (
          <div className="text-[10px] text-foreground/70 line-clamp-1">{subtitle}</div>
        )}
        {footer && (
          <div className="text-[10px] text-muted-foreground line-clamp-1">{footer}</div>
        )}
      </div>
    </div>
  );
}

export default FileCard;
