import { cn } from "@/lib/utils";

/** Codevia rising-slash mark. Replace with the official SVG from the brand kit if needed. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 76 84" className={className} aria-hidden="true">
      <polygon fill="currentColor" points="0,62 76,0 76,26 18,84 0,84" />
      <polygon fill="currentColor" points="22,84 74,34 74,84 60,84 60,70 46,84" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} dir="ltr">
      <Mark className="h-7 w-auto text-lime" />
      {!compact && (
        <span className="text-[1.35rem] font-bold leading-none tracking-[0.04em] text-fg">CODEVIA</span>
      )}
    </span>
  );
}

/** Thin diagonal lines from the deck — the recurring brand motif. */
export function SlashLines({ className }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      viewBox="0 0 800 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill="none" stroke="#b8d433" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <polyline points="-20,10 480,10 640,190 60,780 -20,690" opacity="0.35" />
        <polyline points="-20,250 300,245 -20,580" opacity="0.28" />
        <polyline points="430,900 432,460 640,690 640,900" opacity="0.3" />
      </g>
    </svg>
  );
}
