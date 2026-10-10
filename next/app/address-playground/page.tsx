/**
 * /address-playground: the address playground block as a Next.js App Router page, full-bleed (the
 * block keeps its own gutter). There is no map on it, only search. The key comes from
 * NEXT_PUBLIC_UNMAP_KEY in .env.local; installing the block added the empty line, paste your key.
 */
import { AddressPlayground } from "@/components/ui/address-playground";

export const metadata = { title: "Look up any place in Canada" };

export default function AddressPlaygroundPage() {
  return (
    <main className="h-dvh">
      <AddressPlayground apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
