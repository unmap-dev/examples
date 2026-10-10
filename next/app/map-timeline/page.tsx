import { MapTimeline } from "@/components/unmap-map-timeline";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapTimeline apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
