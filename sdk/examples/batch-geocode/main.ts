import { Geocoder } from "@unmap/geocoding";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/batch-geocode.mdx; configuration and calls match the docs.
start(async (key) => {

const geocoder = new Geocoder({ key: key });
const results = await geocoder.batch(
  ["17 Ave SW Calgary", "Springfield", ""],
  { limit: 1 },
);
showResult(results);

});
