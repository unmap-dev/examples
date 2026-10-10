import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/search-for-a-place.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({ key: key });

const results = await unmap.geocoder.search("Calgary Tower", { limit: 3 });
showResult(results);

});
