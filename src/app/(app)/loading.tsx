export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <div className="mb-6 h-8 w-48 rounded-full bg-raised" />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 rounded-[var(--radius-card)] bg-panel ring-1 ring-inset ring-line" />
        ))}
      </div>
      <div className="mt-4 h-72 rounded-[var(--radius-card)] bg-panel ring-1 ring-inset ring-line" />
    </div>
  );
}
