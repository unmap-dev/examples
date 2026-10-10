import { MapFlows } from "@/components/unmap-map-flows";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapFlows apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
