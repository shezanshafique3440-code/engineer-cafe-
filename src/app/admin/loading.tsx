export default function AdminLoading() {
  return (
    <div>
      <div className="skeleton mb-6 h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton mt-6 h-80 rounded-2xl" />
    </div>
  );
}
