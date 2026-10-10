import { MapInspect } from "@/components/unmap-map-inspect";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><MapInspect apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
