import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/change-the-map-style.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  style: "base",
  mode: "light",
  lang: "en",
  center: [-114.0719, 51.0447],
  zoom: 11,
});
});
