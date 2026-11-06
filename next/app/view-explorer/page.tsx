/**
 * /view-explorer: the view explorer block as a Next.js App Router page, full-bleed (the block
 * keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing the
 * block added the empty line, paste your key.
 */
import { ViewExplorer } from "@/components/ui/view-explorer";

export const metadata = { title: "Find the view" };

export default function ViewExplorerPage() {
  return (
    <main className="h-dvh">
      <ViewExplorer apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
