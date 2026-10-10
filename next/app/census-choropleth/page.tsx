/**
 * /census-choropleth: the census choropleth block as a Next.js App Router page, full-bleed (the
 * block keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing
 * the block added the empty line, paste your key.
 */
import { CensusChoropleth } from "@/components/ui/census-choropleth";

export const metadata = { title: "Compare provinces and territories" };

export default function CensusChoroplethPage() {
  return (
    <main className="h-dvh">
      <CensusChoropleth apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
