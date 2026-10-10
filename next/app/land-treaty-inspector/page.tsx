/**
 * /land-treaty-inspector: the land and treaty inspector block as a Next.js App Router page,
 * full-bleed (the block keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in
 * .env.local; installing the block added the empty line, paste your key.
 */
import { LandTreatyInspector } from "@/components/ui/land-treaty-inspector";

export const metadata = { title: "Look up legal land and treaties" };

export default function LandTreatyInspectorPage() {
  return (
    <main className="h-dvh">
      <LandTreatyInspector apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
