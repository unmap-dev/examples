import { MapMarkers } from "@/components/unmap-map-markers";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapMarkers apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
