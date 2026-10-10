import { maplibregl } from "@unmap/sdk";
import type { Map } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
export function onMapReady(map: Map, callback: () => void) {
  if (map.loaded()) callback(); else map.once("load", callback);
}
export function showResult(result: unknown) {
  document.querySelector("#result")!.textContent = JSON.stringify(result, null, 2);
}
export function start(run: (key: string) => Promise<void>) {
  const button = document.querySelector<HTMLButtonElement>("#run")!;
  const status = document.querySelector("#status")!;
  button.addEventListener("click", async () => {
    const key = import.meta.env.VITE_UNMAP_KEY || document.querySelector<HTMLInputElement>("#key")!.value.trim();
    if (!key) { status.textContent = "Enter a browser key, or set VITE_UNMAP_KEY in sdk/.env.local and restart the server."; return; }
    button.disabled = true;
    status.textContent = "Loading…";
    try { await run(key); status.textContent = "Example started. Reload to run again."; }
    catch (error) { status.textContent = error instanceof Error ? error.message : String(error); button.disabled = false; }
  });
}
