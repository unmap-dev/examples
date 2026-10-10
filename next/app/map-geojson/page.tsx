import { MapGeojson } from "@/components/unmap-map-geojson";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapGeojson apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
