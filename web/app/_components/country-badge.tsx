import type { Country } from "@/lib/schemas";

const COPY: Record<Country, { label: string; className: string }> = {
  USA: { label: "United States", className: "bg-usa text-paper" },
  INDIA: { label: "India", className: "bg-india text-paper" },
};

export function CountryBadge({ country }: { country: Country }) {
  const c = COPY[country];
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-widest px-2 py-1 ${c.className}`}
    >
      {c.label}
    </span>
  );
}
