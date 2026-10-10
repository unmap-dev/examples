# Unmap examples

Runnable examples from [Unmap’s docs](https://unmap.dev/docs/guides/examples) and [templates gallery](https://unmap.dev/templates). Source code is MIT; sample data retains its own attribution and licences.

## Run locally

Use Node 24 and pnpm 10.29.3:

```sh
git clone https://github.com/unmap-dev/examples.git
cd examples
pnpm install --frozen-lockfile
```

Create a browser key at [the dashboard](https://unmap.dev/dashboard), allow your localhost origin, and choose a starter:

| Starter | Key file | Start | Local URL |
| --- | --- | --- | --- |
| Next.js / React | `next/.env.local`: `NEXT_PUBLIC_UNMAP_KEY=…` | `pnpm dev:next` | http://localhost:3000 |
| Nuxt / Vue | `nuxt/.env`: `NUXT_PUBLIC_UNMAP_KEY=…` | `pnpm dev:nuxt` | http://localhost:3001 |
| Plain TypeScript | `sdk/.env.local`: `VITE_UNMAP_KEY=…` | `pnpm dev:sdk` | http://localhost:3002 |
| Downloadable HTML | Replace `YOUR_UNMAP_API_KEY` in a file under `html/` | `python3 -m http.server 3003 --directory html` | http://localhost:3003 |

Each app opens a catalog linking every runnable example. The Next app contains all gallery entries; Nuxt contains the Vue page blocks. TypeScript examples are generated from the same live specs and code snippets as the docs. HTML starters are the docs’ actual downloads, in English and French, including editable GeoJSON.

The registry components and their dependencies are copied in so you can edit them. Gallery components accept `lang="fr"`; downloadable starters also include French versions. Sample content stays in the copied `lib` files. Some examples need the Legal Land or Energy add-on; the original docs and catalog explain which. The map story may request routes or isochrones as chapters open.

`pnpm check` checks catalog/source integrity, TypeScript, and production builds without API credentials. Live requests require your own key. Generated source provenance is recorded in `catalog.json` and `test/fixtures/provenance.json`. Do not remove source attribution when replacing demonstration data.

## Source and related projects

The product repository remains the source for the docs and registry. Verified snapshots update this repository automatically after SDK releases and on manual exports; no private Git history or credentials are exported. See [contributing](CONTRIBUTING.md).

- [SDK source](https://github.com/unmap-dev/sdk-js)
- [Maps reference app](https://github.com/unmap-dev/maps)
- [Example catalog](CATALOG.md)
- [Registry data attribution](DATA.md)
