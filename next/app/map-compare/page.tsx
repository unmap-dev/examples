import { MapCompare } from "@/components/unmap-map-compare";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapCompare apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
