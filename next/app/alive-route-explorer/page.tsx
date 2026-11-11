/**
 * /alive-route-explorer: the alive route explorer block as a Next.js App Router page, full-bleed
 * (the block keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local;
 * installing the block added the empty line, paste your key.
 */
import { AliveRouteExplorer } from "@/components/ui/alive-route-explorer";

export const metadata = { title: "Find a livelier walk" };

export default function AliveRouteExplorerPage() {
  return (
    <main className="h-dvh">
      <AliveRouteExplorer apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
