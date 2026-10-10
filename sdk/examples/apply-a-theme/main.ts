import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/apply-a-theme.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  theme: "u4e",
  center: [-114.0719, 51.0447],
  zoom: 12,
});
});
