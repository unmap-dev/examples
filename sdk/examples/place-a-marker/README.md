---
title: Place a marker from search
description: Geocode a query and pin the first result on the map.
category: geocoding
order: 14
---

# Place a marker from search

The usual "search box plus pin" pattern: geocode the query, then drop a marker on the first result. This is the same live call as [Add a marker](/docs/guides/examples/add-a-marker), written here as a geocoding example.

<LiveExample kind="marker" query="Calgary Tower" center="-114.0719,51.0447" zoom="11" />

Take the first element of the array, or let the user pick from the rest. `place.lng` and `place.lat` are the numbers to hand to MapLibre. If you only need the coordinate and not a map, `@unmap/geocoding` is the standalone client.

See [Search for a place](/docs/guides/examples/search-for-a-place) for the lookup without a pin, and the [Geocoding API](/docs/apis/geocoding) for the result shape.
