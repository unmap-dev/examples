# @unmap/registry - registry.unmap.dev

A [shadcn](https://ui.shadcn.com)-format component registry for unmap maps. Components are
**copied into your project** (not installed as a package), so you own the source and can edit it
freely. They are built on [`@unmap/maps`](../../packages/maps) and wired to the unmap gateway.

The registry has two lanes with shared components and page blocks, plus React templates:

| Lane  | URL prefix                          | What you get                                                                                   |
| ----- | ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| React | `https://registry.unmap.dev/r/`     | `.tsx` components for a shadcn-initialized project; the geocoder and routing panel use your shadcn primitives. |
| Vue   | `https://registry.unmap.dev/r/vue/` | `.vue` components for a shadcn-vue-initialized project; the geocoder and routing panel use your shadcn-vue primitives. |

## Install a component

Both lanes install the shadcn way: register the `@unmap` namespace once, then add items by name
(on Vue the namespace is a `components.json` entry rather than a command — see below).
Files land in `components/ui/` and `lib/` through your `components.json` aliases, next to your own
components, and the CLI asks before overwriting anything. Preview with `--dry-run` or `--diff` on
the React lane; shadcn-vue 2.8 supports neither yet.

### React

```bash
npx shadcn@latest registry add @unmap=https://registry.unmap.dev/r/{name}.json
npx shadcn@latest add @unmap/map @unmap/geocoder @unmap/routing-panel @unmap/marker-popup
```

Run these in a shadcn-initialized project on Base UI, the `base-nova` style that
`npx shadcn init --base base --preset nova` sets up and `unmap create` uses. The React items
assume it: the geocoder is Base UI's Combobox, and the map controls hand your Button to the
Tooltip through Base UI's `render` prop, not Radix's `asChild`. Every map-bound component depends on `map-context`, so
adding one fetches it automatically. Geocoder also installs the official
shadcn Combobox; Routing Panel installs Field, Input, Button and Alert. The URL form still works:
`npx shadcn@latest add https://registry.unmap.dev/r/map.json`. Presets: `r/map-themes.json`.

### Vue and Nuxt

```bash
npx shadcn-vue@latest add https://registry.unmap.dev/r/vue/map.json
```

shadcn-vue (2.8.2) has no `registry add` command, so the URL form is the one that works out of the
box. It does read a `registries` map from `components.json`, so add this entry once and items can
be named instead (`unmap add` writes it into `components.json` for you, on both lanes):

```json
{ "registries": { "@unmap": "https://registry.unmap.dev/r/vue/{name}.json" } }
```

```bash
npx shadcn-vue@latest add @unmap/map @unmap/geocoder @unmap/routing-panel @unmap/marker-popup
```

Run these in a shadcn-vue-initialized project (`npx shadcn-vue init`). Files land one directory
per item, each with an `index.ts`: `components/ui/map/UnmapMap.vue`, `geocoder/UnmapGeocoder.vue`,
`routing-panel/UnmapRoutingPanel.vue`, `marker-popup/UnmapMarker.vue`, `UnmapPopup.vue`,
`UnmapMarkerTooltip.vue` and `UnmapMarkerLabel.vue`, plus `lib/map-context/index.ts`, under `src/`
or Nuxt 4's `app/` as your aliases say (the import stays `@/lib/map-context`). Component names keep
the `Unmap` prefix because `<map>` is an HTML element. On Nuxt, shadcn-nuxt reads each directory's
`index.ts` and auto-imports the components as `<UiUnmapMap>`, `<UiUnmapGeocoder>` and so on; set
`shadcn: { prefix: "" }` in `nuxt.config.ts` to use them as `<UnmapMap>`. The geocoder uses your
shadcn-vue Combobox; the routing panel uses Field, Input, Button and Alert. Upgrading from the flat
`components/ui/Unmap*.vue` layout? Delete those files after re-adding; the new directories sit
beside them. Also delete any `lib/vue/` directory or flat `lib/map-context.ts` file left by an
install from before 2026-09-07: a flat file shadows the new `lib/map-context/index.ts`, since
TypeScript and Vite resolve the file before the directory index.

Not on shadcn-vue? Use the composables in `@unmap/vue` or `@unmap/nuxt` with your own UI instead.

`unmap add <item>` from [`@unmap/cli`](../../packages/cli) does both lanes and `unmap create` scaffolds a
new project with the components already in it.

## Components

Both lanes ship the same thirty-six items, nine of them blocks (below). `map-themes` is one shared file.

| Item            | React                                                                                  | Vue                                                                              |
| --------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `map-context`   | `MapProvider`, `useMap(id?)`, `useMapReady(id?)` — the shared map store (React Context). | `useMapStore()`, `useMapLifecycle()`, `useMap(id?)`, `useMapReady(id?)` (provide/inject). |
| `map-themes`    | `MAP_THEMES`: named short theme presets (`u00` and up) for the theme prop, SDK option, and gateway query parameter. | Same file.                                                                        |
| `map-layers`    | `useLayerSet`: add a GeoJSON source and layers below the labels, re-add after a style swap, update in place; token colour helpers; a per-map filter-clause store the legend and time slider share. Installed automatically by the layer items. | The same, as `useLayerSet(() => ({...}))`. |
| `map`           | `<Map>`: mounts a container, wires a MapLibre map to the gateway, wraps children in `MapProvider`. | `<UnmapMap>`: the same, sharing the map with slotted children. Also exposes `mode` and `lang`. |
| `geocoder`      | Base UI Combobox with debounced server autocomplete, cancellation, keyboard selection. Typed coordinates are reverse geocoded; `bbox`, `proximity` and `renderResult` shape the results. | `<UnmapGeocoder>`: your shadcn-vue Combobox with the same behaviour; the `result` slot draws options. |
| `routing-panel` | shadcn Field/Input/Button/Alert form that resolves endpoints, draws the route, lists its turn-by-turn steps, exposes status. | `<UnmapRoutingPanel>`: your shadcn-vue Field/Input/Button/Alert form with the same behaviour. |
| `route-line`    | `<RouteLine>`: a route or any line, with theme casing, alternatives, progress and a per-point gradient. | `<UnmapRouteLine>`: the same; listen to `@click`. |
| `route-steps`   | `<RouteSteps>`: a route's turn-by-turn steps on your Button, with an icon per maneuver; hover highlights a step's stretch, click frames it. | `<UnmapRouteSteps>`: the same; listen to `@select`. |
| `geojson-layer` | `<GeoJSONLayer>`: draw any GeoJSON as fills, lines and points on your tokens, with hover highlight and click/hover events. | `<UnmapGeojsonLayer>`: the same; set `interactive` and listen to `@click`/`@hover`. |
| `cluster-layer` | `<ClusterLayer>`: cluster many points with MapLibre's own clustering, counts, click to zoom in, and summed properties. | `<UnmapClusterLayer>`: the same; `zoom-on-click` and `@cluster-click`. |
| `heatmap-layer` | `<HeatmapLayer>`: point density as a heatmap on your `--primary`, weighted by a property. | `<UnmapHeatmapLayer>`: the same. |
| `arc-layer`     | `<ArcLayer>`: curved connections between pairs of places, with hover and click. Opposite directions bow apart. | `<UnmapArcLayer>`: the same; set `interactive` and listen to `@click`/`@hover`. |
| `flow-layer`    | `<FlowLayer>`: origin-destination flows in the flowmap.blue style, width by volume, arrowheads, location totals, time and top-N filters, optional clustering by zoom. | `<UnmapFlowLayer>`: the same; set `interactive` and listen to `@click`/`@hover`. |
| `marker-popup`  | `<Marker>` + `<Popup>` + `<MarkerTooltip>` + `<MarkerLabel>`; `draggable` pins report drops through `onDragEnd`, and `<Popup trigger="hover">` opens on hover. | `<UnmapMarker>` + `<UnmapPopup>` + `<UnmapMarkerTooltip>` + `<UnmapMarkerLabel>`; custom pins go in the `marker` slot, drops arrive on `@dragend`. |
| `map-controls`  | `<MapControls>`: zoom, compass, locate, fullscreen, globe and 3D terrain buttons on your ButtonGroup, Button and Tooltip. Pair with `<Map controls={false}>`. | `<UnmapMapControls>`: the same on your shadcn-vue primitives; `@locate` and `@locate-error`. |
| `layer-legend` | `<LayerLegend>`: a checkbox per row that switches style layers on and off (ids, or `prefix*`), optional per-value filters and swatches, controlled or not; survives a style swap. On your shadcn Field and Checkbox. | `<UnmapLayerLegend>`: the same, with `v-model`. |
| `measure` | `<Measure>`: click to add points; the great-circle distance in metres or kilometres (English or French), a live label on the map, Undo and Clear on your shadcn Button; survives a style swap. | `<UnmapMeasure>`: the same; `@change`. |
| `feature-inspector` | `<FeatureInspector>`: the features under a click (or in view, `scope="view"`) in your shadcn Card and Table; click a row to outline the feature and read its properties. | `<UnmapFeatureInspector>`: the same; `@select`. |
| `time-slider` | `<TimeSlider>`: your shadcn Slider driving a time window on style layers, with play, pause, step and loop, controlled or not; sits on each layer's own filter next to a legend's. | `<UnmapTimeSlider>`: the same, with `v-model`. |
| `draw` | `<Draw>`: terra-draw tools for points, lines, polygons and circles, plus select, reshape and delete, on your ToggleGroup, Button and Tooltip. GeoJSON through `value`/`onValueChange`; survives a style swap; layers sit above the labels. | `<UnmapDraw>`: the same, with `v-model`. |
| `compare-swipe` | `<CompareSwipe>`: two `<Map>`s in one frame with one camera and a divider you drag or move with the keyboard (`role="separator"`). `before`/`after` take each side's Map props and children. | `<UnmapCompareSwipe>`: the same; `#before`/`#after` slots and `v-model:position`. |
| `elevation-profile` | `<ElevationProfile>`: the ground elevation along a line (a route, a drawn line or coordinates) from the unmap elevation API on your shadcn Chart, 500 points per request; hover syncs chart and map; distance, gain, loss, lowest and highest in en/fr. Pair with `<RoutingPanel onRoute>`. | `<UnmapElevationProfile>`: the same on your shadcn-vue Chart (Unovis); `@profile` and `@hover`. Pair with `<UnmapRoutingPanel @route>`. |
| `energy-layer-control` | `<EnergyLayerControl>`: a `<LayerLegend>` preset for the energy overlay set. Pair with `profile="energy"` on Map. It renders a bare fieldset: wrap it in your Card or Popover when floating it over the map. | `<UnmapEnergyLayerControl>`: the same preset for Vue. |
| `energy-map` | `<EnergyMap>`: `<Map>` composed with `profile="energy"` and muted cartography. | `<UnmapEnergyMap>`: the same composition for Vue. |
| `well-search` | `<WellSearch>`: geocoder labelled for UWIs. Sends the query only — no `profile=`. | `<UnmapWellSearch>`: the same search box for Vue. |
| `legal-land-search` | `<LegalLandSearch>`: geocoder labelled for LSD. Sends the query only — no `profile=`. | `<UnmapLegalLandSearch>`: the same search box for Vue. |
| `energy-popup` | `<EnergyPopup>`: identify wells / pipelines / facilities on click. | `<UnmapEnergyPopup>`: the same identify popup for Vue. |
| `treaty-context` | `<TreatyContext>`: historic/modern switches, a coordinate lookup and a bilingual details panel listing every treaty record at a point. Pair with `overlays={["treaties"]}`. Needs `@unmap/sdk` with `createTreatyOverlay`; `onSelect` reports each answer, `onError` a failed lookup and its point. | `<UnmapTreatyContext>`: the same for Vue; `@reload` for a retired dataset version, `@select` for each answer, `@error` for a failed lookup. |

Both lanes support multiple maps on a page via an optional map id.

## Blocks

Nine shared items are page blocks: whole pages that compose the components above and run on your key. Each
installs a page (`app/<block>/page.tsx` in a Next.js App Router project, `app/pages/<block>.vue` in
a Nuxt 4 project), its component in `components/ui/`, and any sample data in `lib/`. The page
reads `NEXT_PUBLIC_UNMAP_KEY` or `NUXT_PUBLIC_UNMAP_KEY`; `unmap add <block>` also writes the Nuxt
key line and runtime config and handles the Nuxt 3 layout. Other projects get the component only,
and `unmap create --only` refuses blocks. Metering is per request: each block makes only the
requests below, when the reader acts.

Every block here ships in React and Vue. The React-only templates (`business-locator-01`, `local-guide-01`, `public-notices-01`, `map-story-01`) and the small examples are in the [gallery](https://unmap.dev/templates), beside these blocks.

| Block | The page | Calls | Sample data |
| --- | --- | --- | --- |
| `store-locator` | "Find a branch": search, branches clustered with a list that follows the view, a drive-time area round the chosen one, directions | `/geocode/autocomplete`, `/geocode/reverse`, `/isochrone`, `/route` | Ottawa Public Library branches, City of Ottawa open data (Open Government Licence, City of Ottawa); routes and drive areas credit OpenStreetMap contributors (ODbL) |
| `directions` | Two search boxes, a drive, cycle or walk switch that redraws the route and the reachable area for that mode, travel time as the headline | `/geocode/autocomplete`, `/geocode/reverse`, `/route`, `/isochrone` | None; routes credit OpenStreetMap contributors (ODbL) |
| `flow-map` | Interprovincial migration flows between the capitals on one width scale across years, year scrubber, net in and out per province | Nothing beyond the map | Statistics Canada Table 17-10-0022-01, 2021/2022 to 2025/2026 (Statistics Canada Open Licence) |
| `elevation-explorer` | "See the climb": a trip, a route between two searches or a drawn line, elevation profile linked to a grade-coloured line | `/geocode/autocomplete`, `/geocode/reverse`, `/route`, `/elevation` | Trip ends from the Canadian Geographical Names Database; elevation from the active DEM; supplier credits at unmap.dev/attribution |
| `delivery-tracker` | "Track a delivery": one route per branch replayed as a courier at 30 times real time, arrival card | `/route` | Ottawa Public Library branches (City of Ottawa open data); routes credit OpenStreetMap contributors (ODbL) |
| `census-choropleth` | Provinces and territories by 2021 population, change or density, legend and hover values | Nothing beyond the map | Statistics Canada 2021 Census Boundary Files and Table 98-10-0001-01 (Statistics Canada Open Licence) |
| `land-treaty-inspector` | Legal land search and click, hatched survey cell and unit list, dotted treaty records, add-on explanation | One add-on check, `/identify`, `/geocode/reverse`, `/geocode/autocomplete` | Survey-grid credit on the page; treaty and survey layers credited in the map attribution |
| `address-playground` | Search with no map, every name with its language, result details, nearby by category | `/geocode/autocomplete`, `/geocode/reverse`, `/geocode/nearby` | None |
| `energy-explorer` | Wells, pipelines and facilities, UWI search, layer legend, identify, add-on explanation | One add-on check, `/geocode/autocomplete`, `/identify` | None; Alberta Energy Regulator credit on the page, energy layers credited in the map attribution |

## Usage

### React

```tsx
import { Map } from "@/components/ui/map";
import { Geocoder } from "@/components/ui/geocoder";
import { Marker, Popup } from "@/components/ui/marker-popup";

export default function Demo() {
  const apiKey = process.env.NEXT_PUBLIC_UNMAP_KEY!;
  return (
    <div style={{ height: 480 }}>
      <Map apiKey={apiKey} center={[-114.07, 51.05]} zoom={11}>
        <div style={{ position: "absolute", top: 12, left: 12, width: 280, zIndex: 10 }}>
          <Geocoder apiKey={apiKey} />
        </div>
        <Marker lngLat={[-114.07, 51.05]}>
          <Popup>Downtown Calgary</Popup>
        </Marker>
      </Map>
    </div>
  );
}
```

Named map theme presets install as a small constants module:

```tsx
import { MAP_THEMES } from "@/lib/map-themes";

<Map apiKey={apiKey} theme={MAP_THEMES.boreal} />
```

The import path (`@/components/ui/...`, `@/lib/...`) follows the `aliases` in your project's
`components.json`; the examples above assume the shadcn defaults.

### Vue

```vue
<script setup lang="ts">
import { UnmapMap } from "@/components/ui/map";
import { UnmapGeocoder } from "@/components/ui/geocoder";
import { UnmapMarker, UnmapPopup } from "@/components/ui/marker-popup";
import { MAP_THEMES } from "@/lib/map-themes";

const apiKey = import.meta.env.VITE_UNMAP_KEY as string;
</script>

<template>
  <UnmapMap :api-key="apiKey" :center="[-114.07, 51.05]" :zoom="11" :theme="MAP_THEMES.boreal" style="height: 480px">
    <div style="position: absolute; top: 12px; left: 12px; width: 280px; z-index: 10">
      <UnmapGeocoder :api-key="apiKey" @select="(result) => console.log(result.name)" />
    </div>
    <UnmapMarker :lng-lat="[-114.07, 51.05]">
      <UnmapPopup>Downtown Calgary</UnmapPopup>
    </UnmapMarker>
  </UnmapMap>
</template>
```

`<UnmapMap>` takes the style as `map-style` (`"base"`, `"muted"`, `"outdoor"`, `"blueprint"`, `"blush"`, `"orchid"`, `"canopy"`, `"lagoon"`, `"tropic"`, `"sunset"`, `"bold"`, `"pastel"`, `"atlas"`, `"swiss"`) so the plain `style`
attribute keeps styling the container; `class` and `style` fall through to it. On Nuxt, shadcn-nuxt
reads each directory's `index.ts` and auto-imports the components as `<UiUnmapMap>`,
`<UiUnmapGeocoder>` and so on; set `shadcn: { prefix: "" }` in `nuxt.config.ts` to use them as
`<UnmapMap>`.

### Peer dependencies

React components are React 18/19 + TypeScript; Vue components are Vue 3.5+ single-file components
with `<script setup lang="ts">`. Both import `@unmap/maps` (which re-exports `maplibre-gl`);
`geocoder` also uses `@unmap/geocoding`; `routing-panel` uses `@unmap/geocoding` + `@unmap/routing`.
Each item's `dependencies` lists these and the shadcn CLI installs them.

## Styling

The registry ships no theme and no brand values. Components take on your design system:

- The map container uses `rounded-lg` and `bg-muted`, so it follows your `--radius` and palette.
- The geocoder and routing panel are your own shadcn primitives.
- Markers and route lines default to your `--primary` (resolved to a concrete colour at creation,
  because MapLibre paint cannot read `var()`). A theme code from unmap.dev/create carries its own
  accent; `<Map accent="theme" | "system">` says which wins. The default is `"theme"` when a
  `theme` is set and `"system"` otherwise.
- The zoom and compass buttons are on by default, at `top-right`. `controls={false}` takes them
  off and `controls={{ position: 'bottom-left' }}` moves them; the Vue lane spells it
  `:controls="false"`. The attribution stays either way. `map-controls` puts zoom, compass,
  locate, fullscreen, globe and 3D terrain buttons on your own ButtonGroup, Button and Tooltip in
  their place; its root carries `data-unmap-controls` and the location dot `data-unmap-location`.
- `projection="globe"` draws the map as a sphere. The default is `mercator`, the flat map.
- `maxBounds` (a `[[west, south], [east, north]]` tuple or `"canada"`), `minZoom`, `maxZoom`,
  `interactive`, `cooperativeGestures` and `hash` (camera in the URL) all change in place. The
  limits and the gesture options each fall back to the raw `maplibre` option when their prop is
  unset; `hash` is read from its prop alone. A zoom limit MapLibre would reject (a `minZoom` below
  -2 or above the max zoom, a `maxZoom` below -2, or one that is not a finite number) is dropped
  with a console warning, and an inverted `minZoom`/`maxZoom` pair drops both. A `maxZoom` above
  22 is kept as given.
- Tooltips carry the `unmap-tooltip` class and use the compact style the `map` item's CSS adds;
  marker labels carry `data-unmap-marker-label`. A hover popup and a tooltip are read-only, since
  they close when the pointer leaves the pin; use the click trigger for interactive content. A
  tooltip steps aside while its pin's popup is open, and never shows beside a hover popup.
- MapLibre's popups, zoom and compass buttons, attribution and scale bar are restyled onto
  `--popover`, `--background`, `--border`, `--radius`, `--ring` and `--muted-foreground`, and
  take the page's font through `font: inherit`, by CSS the `map` item adds to your stylesheet on
  install, scoped under `[data-unmap-map]` so other maps in your app are untouched. Dark mode
  follows your `.dark` class.

Every component marks its root with `data-unmap-map`, `data-unmap-geocoder`,
`data-unmap-routing` or `data-unmap-legend`, and every popup carries the `unmap-popup` class, as
hooks for your own CSS.

## Docs for agents

`pnpm build` also writes, from the manifests, the sources and the English docs under
`apps/web/content/docs/frontend/`:

- `public/llms.txt` ([llmstxt.org](https://llmstxt.org)), served at `registry.unmap.dev/llms.txt`:
  every item by docs family, linking its page in each lane, and the React-only templates and
  examples with their gallery pages.
- `public/llm/<item>.md` (React) and `public/llm/vue/<item>.md` (Vue and Nuxt): what the item is,
  the install command (from `apps/web/lib/registry-commands.ts`, the string the docs print), what
  installs with it, a usage example, its props, events and slots read from the source's types and
  JSDoc, and the local types those name.

Both are build output and git-ignored, like `public/r/`. `scripts/generate-llms.ts` writes them;
`scripts/llms/` holds the pure parts, tested in `test/llms-*.test.ts`. Node runs the scripts
directly, so they use erasable TypeScript only and `.ts` import extensions.

- A component whose props the generator cannot read (no type on its props parameter, or
  `defineProps` without a type argument) fails the build and the tests instead of publishing an
  empty table. Export a `<Name>Props` interface.
- Usage comes from code that already exists, never a third copy. A React page embeds the source of
  a `-01` example block that installs the item as more than the map every example renders on (the
  one installing the fewest other items; `map` itself never takes one), or else the item's
  `tsx`/`jsx` fence in the docs; a Vue page embeds the item's `vue` fence. A docs fence belongs to
  the items it imports from `@/components/ui/*`, and the one importing the fewest wins, the item's
  family page first. An item that renders inside a map (it installs `map-context` or `map-layers`
  but not `map`) takes a fence that renders the map too, and its page says to install `map`.
  Every `registry:ui` item needs an example block, or a React and a Vue fence, and the build fails
  otherwise; `PENDING_USAGE` in `scripts/llms/pages.ts` is the escape hatch, and it is empty.
- Templates and examples get an API section read from the component they install (`files[0]`).
- Every item names its docs family in `categories[0]`: one of `map`, `layers`, `search`,
  `overlays`, `tools`, `blocks` (the page at `unmap.dev/docs/frontend/<family>`), or `templates`
  and `examples` for the React-only `-01` items, which keep `maps` second.
- `public/_headers` serves both as UTF-8 with open CORS and leaves `/r/*` alone. `/llm/` must only
  ever hold `.md` files.

## Develop

```bash
pnpm --filter @unmap/registry build      # shadcn build + shadcn-vue build -> public/r/**, then the agent docs -> public/llms.txt + public/llm/**
pnpm --filter @unmap/registry test        # Vitest + jsdom behavior and distribution contracts, React and Vue
pnpm --filter @unmap/registry typecheck   # tsc for the React lane, vue-tsc for the Vue lane
pnpm --filter @unmap/registry preview     # the gallery previews -> preview/dist/ (serve it, open index.html?item=<name>)
```

- **Agent docs** (`public/llms.txt`, `public/llm/**`) are the last step of `build`; see
  [Docs for agents](#docs-for-agents). `test/llms-site.test.ts` builds them in memory, so the tests
  need no prior build.
- **Gallery previews** live in `preview/`: `build.mjs` bundles each page block, template and
  example from the source a reader's `shadcn add` installs, with stock shadcn primitives
  (`preview/ui/`, `preview/lib/`) and the theme tokens (`theme.mjs`), never `apps/web`'s branded
  ones. `items.tsx` holds a loader per previewed item and `entry.tsx` mounts the one a frame asks
  for. `pnpm preview` writes `preview/dist/` (git-ignored) with an empty key against
  `https://api.unmap.dev`; set `UNMAP_PREVIEW_KEY` (and `UNMAP_PREVIEW_GATEWAY`) to see live data.
  The site build runs the same builder into `apps/web/public/previews` with its demo key
  (`apps/web/scripts/build-previews.mjs`), which is what unmap.dev/templates frames.
  `test/preview.test.ts` holds the loaders to the manifest: every page block and React-only item
  has one, except the three place templates, which the site renders itself.

- **Source** lives in `registry/`: `registry/lib/*` and `registry/ui/*.tsx` for React,
  `registry/vue/components/ui/<item>/` for **every** Vue source, the `registry:lib` items included.
  That is not cosmetic: shadcn-vue installs an item with its registry dependencies as one batch and
  derives each file's target from the common source directory of that whole batch, keeping the path
  after an alias segment in it (`components/ui`, `lib`, …) and otherwise falling back to
  `<last root segment>/<remainder>` — so `registry/vue/lib/map-context.ts` shipped beside
  `registry/vue/components/ui/map/*` shares only the alias-less `registry/vue` and lands at
  `lib/vue/lib/map-context.ts`, which is exactly the 2026-09-07 production bug. Under
  `components/ui` the common root is always `registry/vue/components/ui`, so a `registry:lib` item
  installs at `lib/<item>/index.ts` and `@/lib/<item>` still resolves; do not move these files back,
  and note that `generated-registry.test.ts` installs a real batch and asserts it. React (`shadcn`
  4.x) resolves the opposite way — by file type and the target directory's basename, not by a
  batch's common root — so `registry/ui/*.tsx` and `registry/lib/*.tsx` are safe today, but would
  misplace the same way if `shadcn` ever adopted shadcn-vue's resolver. The Vue items also declare
  no `utils` registry dependency, because declaring it misplaces shadcn-vue's own `utils` file the
  same way; `lib/utils.ts` is assumed to already exist from `shadcn-vue init`, and nothing here
  asserts that it does.
- **Manifests** are `registry.json` (React) and `registry.vue.json` (Vue), both on the shadcn
  registry schema (<https://ui.shadcn.com/schema/registry.json>). Add a component by dropping its
  source in `registry/` and adding an item to the right manifest; the contract tests check that the
  two lanes list the same item names.
- **Vue items are shadcn-vue items**: `registry:ui` and `registry:lib`, no `target` fields; the file type picks the target directory (`ui` or `lib`) and the batch's common source root supplies the rest, as above. They declare no `utils` registry dependency either — `shadcn-vue init` always writes `lib/utils.ts`, and asking for shadcn-vue's own `utils` item drags its `registry/bases/reka/lib` root into the batch and misplaces the files with it. `registry/vue/components/ui/map-themes/index.ts` is a byte-identical copy of the React file, held equal by a contract test.
- **Aliases** (React lane only): distributed source uses canonical consumer paths
  (`@/lib/map-context` and `@/components/ui/*`). Local TypeScript/Vitest aliases map those paths to
  the registry source and validation fixtures without changing what consumers receive.
- **Output** is `public/r/*.json` and `public/r/vue/*.json`, one descriptor per item, with file
  `content` inlined.
- **Discovery:** `npx shadcn search @unmap -q map` and `npx shadcn view @unmap/map` (and the
  `shadcn-vue` twins) read `/r/registry.json` and `/r/vue/registry.json`; the generated-registry
  test serves the build over HTTP and runs both.
- **`shadcn-vue view` needs `CONSOLA_LEVEL` set in non-interactive/CI environments.** It prints its
  JSON through `consola.log` (`search` uses plain `console.log`, so it is unaffected); consola
  reads `NODE_ENV` at import time and drops its default level to `warn` when it is `"test"` (as
  Vitest sets it), which is below the `log` level the command writes at — the
  process still exits 0, but stdout is silently empty, no error. `CONSOLA_LEVEL=4` (or higher)
  overrides the computed default and restores the output; the discovery test sets it when invoking
  `shadcn-vue`.

### Build output: regenerated, not committed

`public/r/` is **git-ignored**. It is a deterministic build artifact of `registry/` + the manifests,
so it is regenerated on every deploy (`shadcn build`) rather than committed. This keeps large inlined
`content` blobs out of git history and avoids source/output drift. If you would rather serve a
pinned artifact (e.g. deploy from a static branch), remove `public/r/` from `.gitignore` and commit it.

## Deploy (Cloudflare Workers, assets-only)

`registry.unmap.dev` is a static site: the served artifact is `public/`. Deployed as an
assets-only Worker (`wrangler.jsonc`, directory `./public`), matching `apps/web` — Pages is in
maintenance for new projects and Workers Sites is deprecated in Wrangler v4, so the whole estate
(`unmap-web`, `unmap-gateway`, `unmap-registry`) deploys the same way.

```bash
pnpm --filter @unmap/registry build   # shadcn build + shadcn-vue build -> public/r/**, agent docs -> public/llms.txt + public/llm/**
wrangler deploy                       # from apps/registry, or `pnpm --filter @unmap/registry deploy`
```

- **Result:** each item is served at `https://registry.unmap.dev/r/<name>.json` (React) and
  `https://registry.unmap.dev/r/vue/<name>.json` (Vue), which are exactly the URLs
  `npx shadcn add` (React) and `npx shadcn-vue add` (Vue) fetch. The agent docs are served at
  `https://registry.unmap.dev/llms.txt` and `https://registry.unmap.dev/llm/<item>.md`
  (`/llm/vue/<item>.md` for Vue), and `public/_headers` gives them their UTF-8 type and open CORS.
- The gallery previews are not deployed here: unmap.dev builds and serves them.
- `.github/workflows/deploy-registry.yml` runs this on every push to `main`, mirroring
  `deploy-web.yml`.
- For a preview without the custom domain, the same `wrangler deploy` also attaches
  `unmap-registry.<subdomain>.workers.dev` (`workers_dev: true` in `wrangler.jsonc`); the
  `registryDependencies` in both manifests point at the production `registry.unmap.dev` host, so
  update them if you serve the registry from a different origin.

## Roadmap

- **Style Dictionary** dual-emit (CSS vars + MapLibre paint) from one token source.
- Expose the registry via MCP so agents can install components directly.

## Templates and examples (React blocks)

Complete compositions use `registry:block`, alongside the existing `registry:ui` primitives. They copy editable source, and the templates also copy bilingual sample data; they do not ship a brand theme or an API credential. Templates use shadcn **Base UI** components.

| Item | Export | Included behavior |
| --- | --- | --- |
| `business-locator-01` | `BusinessLocator` | Search, categories, linked location details and markers |
| `local-guide-01` | `LocalGuide` | Ordered stops, previous/next navigation, map focus |
| `public-notices-01` | `PublicNotices` | Search, status filters, notice details and markers |
| `map-story-01` | `MapStory` | Scroll-driven chapters that move the camera and reveal a route and travel-time areas |
| `map-markers-01` | `MapMarkers` | Accessible marker button and click-to-open popup |
| `map-measure-01` | `MapMeasure` | Click points and read the distance as you go, with a live label on the line |
| `map-inspect-01` | `MapInspect` | Click a map of Ottawa to list the features there and read their properties |
| `map-timeline-01` | `MapTimeline` | Play or drag a time slider to add sample bike-share docks to Calgary year by year |
| `map-draw-01` | `MapDraw` | Draw points, lines, areas and circles and get them back as GeoJSON |
| `map-compare-01` | `MapCompare` | Drag a divider across Vancouver to compare the base and outdoor styles |
| `map-elevation-01` | `MapElevation` | A sample trail's elevation profile, linked to the map on hover |
| `map-geojson-01` | `MapGeojson` | Illustrative service zones over Calgary; click one for its name and hours |
| `map-clusters-01` | `MapClusters` | Illustrative points in Montréal in clusters that zoom in until they split |
| `map-heatmap-01` | `MapHeatmap` | A heatmap of illustrative points in Toronto, counted or weighted |
| `map-arcs-01` | `MapArcs` | Arcs from Winnipeg to six capitals, each with its distance |
| `map-flows-01` | `MapFlows` | A year of Statistics Canada migration between the western provinces, as flows |

```bash
npx shadcn@latest add https://registry.unmap.dev/r/business-locator-01.json
# Or, after registering @unmap:
npx shadcn@latest add @unmap/business-locator-01
```

```tsx
import { BusinessLocator } from "@/components/unmap-business-locator"

<BusinessLocator apiKey="um_live_..." lang="en" />
```

The CLI places files under the consumer's configured components/lib aliases. Templates share `components/unmap-map-template.tsx` and `lib/map-template.ts`; each has its own wrapper and `lib/<template>-01-data.ts`. Repeated installs reuse identical shared files. Pass `lang="fr"` for French or an optional `theme` preset for cartography. Replace the sample data in the copied lib file, or pass your own typed `data` prop. Allow the app's origin on the browser key.

Interactive previews: [unmap.dev/templates](https://unmap.dev/templates). The three place templates (`business-locator-01`, `local-guide-01`, `public-notices-01`) also download there as a standalone HTML page and as GeoJSON; `map-story-01` and the examples do not. These templates and examples ship in the React lane; the nine page blocks above ship in both lanes.

To add another block, add its source files and a `registry:block` item to `registry.json`, declare every registry/package dependency, and use `@components/` targets for templates and examples; page blocks follow the page-block contract (`registry:page` plus `registry:ui`). Extend the generated-registry install checks and the consumer behavior tests. Build artifacts are generated by `pnpm build`.
