import { BusinessLocator } from "@/components/unmap-business-locator";
export default function Page() {
  return <main className="min-h-dvh p-4 sm:p-6"><BusinessLocator apiKey={process.env.NEXT_PUBLIC_UNMAP_KEY ?? ""} /></main>;
}
