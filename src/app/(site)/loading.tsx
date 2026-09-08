export default function Loading() {
  return (
    <div className="container py-10">
      <div className="space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-cream-200 bg-white">
            <div className="skeleton aspect-[4/3] rounded-none" />
            <div className="space-y-2.5 p-4">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
