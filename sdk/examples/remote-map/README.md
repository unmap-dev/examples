---
title: Remote map
description: Compose the remote overlay set with one profile option. Overlay tiles are live on R2.
category: maps
order: 12
---

# Remote map

`profile: "remote"` is a composition preset, not a style. Prefer `muted` so customer
markers stay visually dominant.

<LiveExample kind="map" style="muted" overlays="remote.airports" overlayChoices="remote.airports,parks,aboriginal-lands,survey.nts" center="-114.44,62.46" zoom="8" />

`remote.airports` overlay tiles are live on R2 (the basemap's own roads layer is served through z14). The basemap still renders if an archive is missing. A key
without the `remote` add-on still gets the basemap and the core layers in the preset; asking for
`remote.airports` explicitly is `403 addon_required`. This is visualization only. It is not winter-road routing.

```ts
import { Unmap } from "@unmap/sdk";

const unmap = new Unmap({
  key: "um_live_...",
  container: "map",
  style: "muted",
  profile: "remote",
  center: [-114.3718, 62.454],
  zoom: 6,
});
```

[Remote profile](/docs/overlays/remote) and [Layers](/docs/overlays/layers) have the catalog and the
coverage caveats.
