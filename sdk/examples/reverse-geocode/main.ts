import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/reverse-geocode.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({ key: key });

const here = await unmap.geocoder.reverse(-114.0719, 51.0447);
showResult(here);

});
