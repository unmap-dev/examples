# Working on Unmap examples

Read README.md, CATALOG.md, and CONTRIBUTING.md. Choose the closest existing example and the developer's existing framework. Prioritize a working first map over installing the entire workspace.

## Start only what you need

Use Node.js 24 and pnpm 10.29.3. The no-install demo is `node scripts/serve.mjs quickstart 3003`; its key is entered in the page.

| Lane | Focused install | Start | Check |
| --- | --- | --- | --- |
| TypeScript | `pnpm --filter unmap-examples-sdk install --frozen-lockfile` | `pnpm dev:sdk` (3002) | `pnpm --dir sdk check` |
| React/Next | `pnpm --filter unmap-examples-next install --frozen-lockfile` | `pnpm dev:next` (3000) | `pnpm --dir next check` |
| Vue/Nuxt | `pnpm --filter unmap-examples-nuxt install --frozen-lockfile` | `pnpm dev:nuxt` (3001) | `pnpm --dir nuxt check` |

For an upstream PR spanning lanes, install the full workspace and run `pnpm check`. API credentials are not required for checks. The root integrity tests intentionally verify canonical exported files; an intentional component edit must be backported upstream, not concealed by updating hashes. Fork authors can customize source and adapt integrity checks explicitly.

## Source and integration

- `sdk/examples/<slug>/main.ts`: plain TypeScript docs examples; runtime.ts handles page key input and status.
- `next/app/<slug>/page.tsx`: React entry pages; blocks are in `next/components/ui`, helpers and sample data in `next/lib`.
- `nuxt/app/pages/<slug>.vue`: Vue entry pages; blocks and helpers in `nuxt/app/components/ui` and `nuxt/app/lib`.
- `html/<template>/`: actual English/French docs downloads and matching GeoJSON. Rendered HTML uses embedded data.
- `quickstart/`: tiny CDN demos with no dependencies; keys stay in page memory.
- `catalog.json`, `CATALOG.md`: source-to-docs mapping; `DATA.md` and `THIRD_PARTY.md`: attribution and licenses.

Copy transitive component imports, required registry CSS, and worker setup when extracting an example. Prefer the registry installer in an existing shadcn app. Import MapLibre CSS once, give the map a height, use [longitude, latitude], and clean up map resources. Match the installed MapLibre version to its served worker. Do not replace the developer's design system or add a second framework.

Use ignored lane environment files: sdk/.env.local (VITE_UNMAP_KEY), next/.env.local (NEXT_PUBLIC_UNMAP_KEY), nuxt/.env (NUXT_PUBLIC_UNMAP_KEY). Never read, log, or commit actual keys. Tell the developer which exact localhost origin to allow. Public browser variables must not contain server credentials.

The basemap is worldwide; geocoding/routing cover Canada. Some examples require Legal Land or Energy add-ons. Preserve source/data attribution and French support where supplied.

Maintainers apply accepted upstream PRs to the product docs/registry and export fresh snapshots. Public contributors can open a PR here; your own fork can be customized normally. Do not add independent package publishing or Unmap production deploy workflows.

Report the selected example, files changed, commands/check results, local URL, and remaining configuration. Do not claim a live map or API was verified without testing with an authorized key.
