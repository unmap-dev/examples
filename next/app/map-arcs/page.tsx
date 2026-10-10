import { MapArcs } from "@/components/unmap-map-arcs";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapArcs apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
