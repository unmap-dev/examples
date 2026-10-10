import type { ReactNode } from "react";
import "@/lib/maplibre-worker";
import "./globals.css";
export const metadata = { title: "Unmap examples" };
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en-CA"><body>{children}</body></html>;
}
