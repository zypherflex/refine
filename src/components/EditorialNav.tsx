import Link from "next/link";

export function EditorialNav() {
  const items = [["/editorial", "Queue"], ["/editorial/announcements/new", "New announcement"], ["/editorial/documents", "Documents and extraction"], ["/editorial/news-leads", "News leads"], ["/editorial/sources", "Sources"], ["/editorial/conflicts", "Conflicts"], ["/corrections", "Corrections log"]];
  return (
    <nav aria-label="Editorial" className="mb-5 flex flex-wrap gap-2 text-sm">
      {items.map(([h, l]) => <Link key={h} href={h} className="btn-secondary btn-sm">{l}</Link>)}
    </nav>
  );
}
