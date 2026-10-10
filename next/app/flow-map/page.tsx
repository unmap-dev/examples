/**
 * /flow-map: the migration flow map block as a Next.js App Router page, full-bleed (the block keeps
 * its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing the block
 * added the empty line, paste your key.
 */
import { FlowMap } from "@/components/ui/flow-map";

export const metadata = { title: "Follow interprovincial migration" };

export default function FlowMapPage() {
  return (
    <main className="h-dvh">
      <FlowMap apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
