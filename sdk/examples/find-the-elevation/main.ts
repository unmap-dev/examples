import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/find-the-elevation.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  center: [-114.0719, 51.0447],
  zoom: 11,
});

const [metres] = await unmap.elevation.get([-114.0719, 51.0447]);

unmap.map!.on("click", async (e) => {
  const [here] = await unmap.elevation.get([e.lngLat.lng, e.lngLat.lat]);
  console.log(here === null ? "no data here" : `${here} m`);
});
showResult(metres);

});
