import { PublicNotices } from "@/components/unmap-public-notices";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><PublicNotices apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
