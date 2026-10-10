---
title: Search for a place
description: Forward geocoding. Turn an address or a place name into a coordinate.
category: geocoding
order: 10
---

# Search for a place

Forward geocoding turns text into a coordinate. `search` ranks by relevance over Canadian addresses and places, so "Calgary Tower" finds the tower and not every row that mentions Calgary.

<LiveExample kind="search" query="Calgary Tower" limit="3" center="-114.0719,51.0447" />

Every call resolves to an array, even for zero or one match. Each result carries `id`, `name`, `layer`, `lng`, `lat`, a `names` map when the place has names in more than one language, and a structured `address` when one exists. Search results add a `score`.

To keep results inside a box, pass `bbox` as `[minLng, minLat, maxLng, maxLat]`. It is a hard filter, not a bias: a row whose point falls outside the box is dropped.

```ts
const results = await unmap.geocoder.search("Tower", {
  bbox: [-114.12, 51.02, -114.02, 51.07],
  limit: 5,
});
```

The [Geocoding API](/docs/apis/geocoding) documents every parameter and the result shape. `@unmap/geocoding` is the same client with no map dependency.
