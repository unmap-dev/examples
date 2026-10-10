import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/find-nearby-places.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({ key: key });

const nearby = await unmap.geocoder.nearby("pharmacy", { near: [-114.0719, 51.0447], radius: 1500, limit: 5 });
showResult(nearby);

});
