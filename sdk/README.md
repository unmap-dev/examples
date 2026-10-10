# Plain TypeScript / Vite examples

Runnable plain TypeScript API examples. Start from the [root guide](../README.md) and [catalog](../CATALOG.md). Use Node.js 24 and pnpm 10.29.3.

From the repository root:

```sh
pnpm --filter unmap-examples-sdk install --frozen-lockfile
cp sdk/.env.example sdk/.env.local
```

Set `VITE_UNMAP_KEY` in `sdk/.env.local` to your browser key. Allow **http://localhost:3002** on it in the [dashboard](https://unmap.dev/dashboard), then run:

```sh
pnpm dev:sdk
```

Open [localhost:3002](http://localhost:3002). Edit [`examples/display-a-map/main.ts`](examples/display-a-map/main.ts) to start. Restart after changing environment configuration. You can also enter a key in each example page and skip the environment file.

The dev/build scripts copy the matching MapLibre module worker to `public/maplibre/`. Keep that step and the MapLibre CSS import if you copy an example to another app. Coordinates use [longitude, latitude]. Preserve attribution.

To validate this lane from the repository root:

```sh
pnpm --dir sdk check
```

Checks do not require API credentials. See [troubleshooting](../README.md#troubleshooting), [agent prompt](../AGENT_PROMPT.md), and [contributing](../CONTRIBUTING.md). Never commit actual keys or generated build output.
