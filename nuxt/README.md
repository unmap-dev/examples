# Nuxt / Vue examples

Runnable Vue page blocks. Start from the [root guide](../README.md) and [catalog](../CATALOG.md). Use Node.js 24 and pnpm 10.29.3.

From the repository root:

```sh
pnpm --filter unmap-examples-nuxt install --frozen-lockfile
cp nuxt/.env.example nuxt/.env
```

Set `NUXT_PUBLIC_UNMAP_KEY` in `nuxt/.env` to your browser key. Allow **http://localhost:3001** on it in the [dashboard](https://unmap.dev/dashboard), then run:

```sh
pnpm dev:nuxt
```

Open [localhost:3001](http://localhost:3001). Edit [`app/pages/store-locator.vue`](app/pages/store-locator.vue) to start. Restart after changing environment configuration. Components and demonstration data are included for customization.

The dev/build scripts copy the matching MapLibre module worker to `public/maplibre/`. Keep that step and the MapLibre CSS import if you copy an example to another app. Coordinates use [longitude, latitude]. Preserve attribution.

To validate this lane from the repository root:

```sh
pnpm --dir nuxt check
```

Checks do not require API credentials. See [troubleshooting](../README.md#troubleshooting), [agent prompt](../AGENT_PROMPT.md), and [contributing](../CONTRIBUTING.md). Never commit actual keys or generated build output.
