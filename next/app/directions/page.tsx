/**
 * /directions: the directions block as a Next.js App Router page, full-bleed (the block keeps its
 * own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing the block added
 * the empty line, paste your key.
 */
import { Directions } from "@/components/ui/directions";

export const metadata = { title: "Get directions" };

export default function DirectionsPage() {
  return (
    <main className="h-dvh">
      <Directions apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
