/**
 * /ski-resort-explorer: the ski resort explorer block as a Next.js App Router page, full-bleed (the
 * block keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing
 * the block added the empty line, paste your key. The ski areas need the Ski add-on; without it
 * the page says why.
 */
import { SkiResortExplorer } from "@/components/ui/ski-resort-explorer";

export const metadata = { title: "Explore Canada's ski areas" };

export default function SkiResortExplorerPage() {
  return (
    <main className="h-dvh">
      <SkiResortExplorer apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
