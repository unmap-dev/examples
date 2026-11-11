/**
 * /urban-noise-map: the urban noise block as a Next.js App Router page, full-bleed (the block
 * keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing the
 * block added the empty line, paste your key. The noise data needs the Urban Noise add-on; without
 * it the page says why.
 */
import { UrbanNoiseMap } from "@/components/ui/urban-noise-map";

export const metadata = { title: "Check how loud a street is" };

export default function UrbanNoiseMapPage() {
  return (
    <main className="h-dvh">
      <UrbanNoiseMap apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
