import { maplibregl } from "@unmap/maps";
export default defineNuxtPlugin(() => {
  maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
});
