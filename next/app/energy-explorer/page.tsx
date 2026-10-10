/**
 * /energy-explorer: the energy explorer block as a Next.js App Router page, full-bleed (the block
 * keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing the
 * block added the empty line, paste your key. The energy layers need the Energy add-on; without it
 * the page says why.
 */
import { EnergyExplorer } from "@/components/ui/energy-explorer";

export const metadata = { title: "Explore Alberta's wells and pipelines" };

export default function EnergyExplorerPage() {
  return (
    <main className="h-dvh">
      <EnergyExplorer apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
