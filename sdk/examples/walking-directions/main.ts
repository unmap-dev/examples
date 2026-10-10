import { Unmap } from "@unmap/sdk";
import { start, showResult, onMapReady } from "../../runtime";
import "../../style.css";

// Generated from apps/web/content/docs/guides/examples/walking-directions.mdx; configuration and calls match the docs.
start(async (key) => {

const unmap = new Unmap({
  key: key,
  container: "map",
  center: [-114.03, 51.07],
  zoom: 11,
});

const route = await unmap.router.route([-114.0719, 51.0447], [-113.9871, 51.0899], { mode: "pedestrian" });

onMapReady(unmap.map!, () => {
  unmap.map!.addSource("route", {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: route.geometry },
  });
  unmap.map!.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#FF3E9A", "line-width": 3 },
  });
});
showResult(route);

});
