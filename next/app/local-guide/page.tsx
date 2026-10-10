import { LocalGuide } from "@/components/unmap-local-guide";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><LocalGuide apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
