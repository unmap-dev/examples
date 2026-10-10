import { MapHeatmap } from "@/components/unmap-map-heatmap";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapHeatmap apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
