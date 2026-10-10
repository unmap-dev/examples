/**
 * /elevation-explorer: the elevation explorer block as a Next.js App Router page, full-bleed (the
 * block keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing
 * the block added the empty line, paste your key.
 */
import { ElevationExplorer } from "@/components/ui/elevation-explorer";

export const metadata = { title: "See the climb" };

export default function ElevationExplorerPage() {
  return (
    <main className="h-dvh">
      <ElevationExplorer apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
