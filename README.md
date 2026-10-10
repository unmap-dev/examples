# Unmap examples, templates & blocks

Start with a working map, then copy the source into your project. These are runnable versions of the [API examples](https://unmap.dev/docs/guides/examples), [templates](https://unmap.dev/templates), and [UI blocks](https://unmap.dev/docs/frontend/blocks) in Unmap's docs.

[Complete catalog](CATALOG.md) · [Get a browser key](https://unmap.dev/dashboard) · [SDK source](https://github.com/unmap-dev/sdk-js) · [Full Maps app](https://github.com/unmap-dev/maps) · [Agent prompt](AGENT_PROMPT.md)

## First map in under 60 seconds · no install

Have **Git, Node.js 24+, and a browser key** ready. Allow **`http://localhost:3003`** on the key in the dashboard. You can try a map, search, and directions without installing any dependencies:

```sh
git clone --depth 1 https://github.com/unmap-dev/examples.git
cd examples
node scripts/serve.mjs quickstart 3003
```

Open **[localhost:3003/basic-map.html](http://localhost:3003/basic-map.html)**, paste your browser key, and click **Run example**. You should see Calgary. The key stays in page memory and is not saved. Edit [`quickstart/example.js`](quickstart/example.js), refresh, and make it yours. `Ctrl+C` stops the server.

The 60-second target assumes these prerequisites and a key are ready. The first map needs an internet connection to the SDK CDN and API. Framework installs download more dependencies; install only the lane you need below.

## Choose a starter

Use **pnpm 10.29.3** for the framework starters. Enable your installed Corepack with `corepack enable`, or install that version using your normal Node setup. Run the following commands from the repository root.

| Starter | What's included | Install only this lane | Start | URL |
| --- | --- | --- | --- | --- |
| Plain TypeScript / Vite | 25 API examples | `pnpm --filter unmap-examples-sdk install --frozen-lockfile` | `pnpm dev:sdk` | http://localhost:3002 |
| Next.js / React | 12 map examples, 4 templates, 9 page blocks | `pnpm --filter unmap-examples-next install --frozen-lockfile` | `pnpm dev:next` | http://localhost:3000 |
| Nuxt / Vue | 9 page blocks | `pnpm --filter unmap-examples-nuxt install --frozen-lockfile` | `pnpm dev:nuxt` | http://localhost:3001 |
| HTML + GeoJSON | 3 downloadable templates, English and French | No install | `node scripts/serve.mjs html 3003` | http://localhost:3003 |

Each framework opens a catalog linking its examples. Allow the exact origin for your chosen starter on your browser key.

### Plain TypeScript · fastest editable API examples

```sh
pnpm --filter unmap-examples-sdk install --frozen-lockfile
pnpm dev:sdk
```

Open **[Display a map](http://localhost:3002/examples/display-a-map/)**, paste your key in the page, and press **Run example**. No environment file is needed. Edit [`sdk/examples/display-a-map/main.ts`](sdk/examples/display-a-map/main.ts); Vite reloads it automatically. Each example's directory includes the original docs and its printed snippet.

For a key shared across examples, copy [`sdk/.env.example`](sdk/.env.example) to `sdk/.env.local`, set `VITE_UNMAP_KEY`, and restart. A configured environment key takes precedence over the page input.

### Next.js / React

```sh
pnpm --filter unmap-examples-next install --frozen-lockfile
cp next/.env.example next/.env.local
```

Set `NEXT_PUBLIC_UNMAP_KEY` in `next/.env.local`, then run `pnpm dev:next`. Open **[Store locator](http://localhost:3000/store-locator/)** or **[Markers](http://localhost:3000/map-markers/)**. The page entry is [`next/app/store-locator/page.tsx`](next/app/store-locator/page.tsx); its block is [`next/components/ui/store-locator.tsx`](next/components/ui/store-locator.tsx).

### Nuxt / Vue

```sh
pnpm --filter unmap-examples-nuxt install --frozen-lockfile
cp nuxt/.env.example nuxt/.env
```

Set `NUXT_PUBLIC_UNMAP_KEY` in `nuxt/.env`, then run `pnpm dev:nuxt`. Open **[Store locator](http://localhost:3001/store-locator)**. Start editing [`nuxt/app/pages/store-locator.vue`](nuxt/app/pages/store-locator.vue), or the block in [`nuxt/app/components/ui/store-locator`](nuxt/app/components/ui/store-locator).

### Downloadable HTML templates

Serve `html/` with the command in the table. The files are the docs' actual downloads, with no framework dependencies. Replace `YOUR_UNMAP_API_KEY` locally in the chosen HTML file before refreshing. Keep your configured copy outside Git or revert the key before committing. For a demo that accepts the key in the page instead, use `quickstart/`.

Each template has `en.html`, `fr.html`, and matching GeoJSON under `html/<template>/`. Edit the data embedded in the HTML when changing the rendered locations; the GeoJSON file is a matching download for use in other projects.

## Find the right starting point

| You want to… | Start here |
| --- | --- |
| Put a map on a page | [`sdk/examples/display-a-map`](sdk/examples/display-a-map) |
| Search Canadian places | [`sdk/examples/search-for-a-place`](sdk/examples/search-for-a-place) |
| Calculate directions | [`sdk/examples/get-directions`](sdk/examples/get-directions) |
| Plot your own GeoJSON | [`next/app/map-geojson/page.tsx`](next/app/map-geojson/page.tsx) |
| Build a branch finder | [`next/app/store-locator/page.tsx`](next/app/store-locator/page.tsx) / [`nuxt/app/pages/store-locator.vue`](nuxt/app/pages/store-locator.vue) |
| Publish a local guide | [`next/app/local-guide/page.tsx`](next/app/local-guide/page.tsx) / [`html/local-guide`](html/local-guide) |
| Tell a geographic story | [`next/app/map-story/page.tsx`](next/app/map-story/page.tsx) |
| Explore every example | [CATALOG.md](CATALOG.md), with source and guide links |

## Copy an example into your app

1. Choose the closest entry in [CATALOG.md](CATALOG.md) and open its guide.
2. Copy the page and its imported map components, `lib` helpers, and sample data. The repository includes those dependencies so you can edit them.
3. Install the `@unmap/*` packages used by that example. Use the same MapLibre version for the renderer and worker; copy the lane's worker setup if your app does not already have it.
4. Import MapLibre CSS once and preserve the registry CSS required by the copied components. Give the map a height and use **[longitude, latitude]** coordinates.
5. Replace demonstration data with your own data, preserve applicable attribution, and use your app's browser key configuration.

For an existing shadcn project, the [registry installation guide](https://unmap.dev/docs/frontend/map) can install components and their dependencies directly. Sample data attribution is in [DATA.md](DATA.md); copied UI license notices are in [THIRD_PARTY.md](THIRD_PARTY.md).

Gallery components accept `lang="fr"`; HTML templates include separate French downloads. Some Legal Land and Energy examples need add-ons. Check the linked guide before choosing them as a first example. The map story may request routes or travel-time areas as chapters open.

## Build with an agent

Paste this into your clone, fork, or existing app:

```text
Use https://github.com/unmap-dev/examples to build [describe my use case].
Read README.md, AGENTS.md, and CATALOG.md. Choose the nearest example for my
existing framework; install only that lane. Reuse its components and helpers,
keep attribution, and replace sample data only as needed. Keep my browser key
in ignored environment configuration or the demo's page input. Configure
MapLibre CSS, its matching worker, map height, and lifecycle cleanup. Run the
chosen lane's checks, start the app, and report the URL and setup steps.
```

[AGENT_PROMPT.md](AGENT_PROMPT.md) includes a more detailed prompt and completion criteria. [AGENTS.md](AGENTS.md) provides repository instructions for compatible agents.

## Check your changes

For one starter, use its focused check:

```sh
pnpm --dir sdk check   # TypeScript + production build
pnpm --dir next check  # TypeScript + static Next.js build
pnpm --dir nuxt check  # Vue types + static Nuxt build
```

To work on all starters, install the whole workspace with `pnpm install --frozen-lockfile`, then run `pnpm check`. This also verifies catalog and source integrity. Checks require no API key; live maps and requests do. The full workspace workflow is separate from the quickstart.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Framework catalog loads, map does not | Set the key in that lane's file above and restart; plain TypeScript also accepts a page input. |
| Key / origin rejected | Allow the exact `http://localhost:<port>` origin. `127.0.0.1` needs a separate allowed origin. |
| Blank map / controls misplaced | Give the map a height and import MapLibre CSS. |
| Worker 404 | Start with the supplied dev script so the matching worker is copied to `public/maplibre/`. |
| Layer denied | Enable the required add-on on your key, or choose a basic example. |
| pnpm / dev command missing | Use pnpm 10.29.3 in the repo root and install the selected lane first. |
| Port already used | Stop the other process or change the lane's port; update your allowed origin too. |

The basemap is worldwide; search and routing cover Canada. Browser environment variables are visible in the delivered app; use origin restrictions and keep server credentials server-side.

## Contributing and license

[Issues](https://github.com/unmap-dev/examples/issues) and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). These verified snapshots come from the product repository's docs and registry. Maintainers backport accepted upstream changes there before the next sync. Your own fork can be customized normally.

Source is [MIT](LICENSE). Sample data and dependencies retain their own attribution and licenses. Hosted API use requires a key and follows its service terms and quotas.
