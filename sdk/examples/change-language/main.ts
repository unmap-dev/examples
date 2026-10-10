import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/change-language.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  style: "base",
  mode: "light",
  lang: "fr",
  center: [-73.5673, 45.5017],
  zoom: 12,
});
});
