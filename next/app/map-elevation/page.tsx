import { MapElevation } from "@/components/unmap-map-elevation";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapElevation apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
