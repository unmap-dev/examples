import { Unmap, maplibregl } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/add-a-marker.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  center: [-114.0719, 51.0447],
  zoom: 11,
});

const [place] = await unmap.geocoder.search("Calgary Tower");

new maplibregl.Marker({ color: "#FF3E9A" })
  .setLngLat([place.lng, place.lat])
  .setPopup(new maplibregl.Popup().setText(place.name))
  .addTo(unmap.map!);
});
