import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/show-the-globe.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  projection: "globe",
  center: [-96, 56],
  zoom: 0,
});
});
