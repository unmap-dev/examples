/**
 * /store-locator: the store-locator block as a Next.js App Router page, full-bleed (the block keeps
 * its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing the block
 * added the empty line, paste your key.
 */
import { StoreLocator } from "@/components/ui/store-locator";

export const metadata = { title: "Find a branch" };

export default function StoreLocatorPage() {
  return (
    <main className="h-dvh">
      <StoreLocator apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
