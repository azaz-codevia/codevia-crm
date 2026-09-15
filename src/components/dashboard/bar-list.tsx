import { cn } from "@/lib/utils";

/** Lightweight horizontal bars — reads correctly in both LTR and RTL. */
export function BarList({
  items,
  empty,
  accent = "bg-lime",
}: {
  items: { label: string; value: number; hint?: string; href?: string }[];
  empty: string;
  accent?: string;
}) {
  if (items.length === 0) return <p className="px-5 pb-6 text-sm text-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-3 px-5 pb-5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-soft">{item.label}</span>
            <span className="num shrink-0 font-medium">
              {item.value}
              {item.hint && <span className="ms-1.5 text-xs font-normal text-muted">{item.hint}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className={cn("h-full rounded-full", accent)} style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
