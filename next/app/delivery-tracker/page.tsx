/**
 * /delivery-tracker: the delivery tracker block as a Next.js App Router page, full-bleed (the
 * block keeps its own gutter). The key comes from NEXT_PUBLIC_UNMAP_KEY in .env.local; installing
 * the block added the empty line, paste your key.
 */
import { DeliveryTracker } from "@/components/ui/delivery-tracker";

export const metadata = { title: "Track a delivery" };

export default function DeliveryTrackerPage() {
  return (
    <main className="h-dvh">
      <DeliveryTracker apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} className="h-full" />
    </main>
  );
}
