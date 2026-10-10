import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/mining-map.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  style: "muted",
  overlays: ["mining.occurrences"],
  center: [-114.5, 56],
  zoom: 6,
});
});
