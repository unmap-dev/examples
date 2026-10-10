# Next.js / React examples

Runnable React gallery examples, templates, and blocks. Start from the [root guide](../README.md) and [catalog](../CATALOG.md). Use Node.js 24 and pnpm 10.29.3.

From the repository root:

```sh
pnpm --filter unmap-examples-next install --frozen-lockfile
cp next/.env.example next/.env.local
```

Set `NEXT_PUBLIC_UNMAP_KEY` in `next/.env.local` to your browser key. Allow **http://localhost:3000** on it in the [dashboard](https://unmap.dev/dashboard), then run:

```sh
pnpm dev:next
```

Open [localhost:3000](http://localhost:3000). Edit [`app/store-locator/page.tsx`](app/store-locator/page.tsx) to start. Restart after changing environment configuration. Components and demonstration data are included for customization.

The dev/build scripts copy the matching MapLibre module worker to `public/maplibre/`. Keep that step and the MapLibre CSS import if you copy an example to another app. Coordinates use [longitude, latitude]. Preserve attribution.

To validate this lane from the repository root:

```sh
pnpm --dir next check
```

Checks do not require API credentials. See [troubleshooting](../README.md#troubleshooting), [agent prompt](../AGENT_PROMPT.md), and [contributing](../CONTRIBUTING.md). Never commit actual keys or generated build output.
