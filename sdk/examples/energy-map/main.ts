import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/energy-map.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  style: "muted",
  overlays: ["energy.wells"],
  center: [-114.0719, 51.0447],
  zoom: 8,
});
});
