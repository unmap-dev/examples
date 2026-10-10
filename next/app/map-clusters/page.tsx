import { MapClusters } from "@/components/unmap-map-clusters";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapClusters apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
