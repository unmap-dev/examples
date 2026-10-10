---
title: Reverse geocode a point
description: Turn a coordinate into the nearest address or place.
category: geocoding
order: 12
---

# Reverse geocode a point

Reverse geocoding goes the other way: a longitude and a latitude become the nearest place. Results are ordered by real-world distance, not by relevance.

<LiveExample kind="reverse" center="-114.0719,51.0447" />

Pass longitude first. The answer is still an array. A downtown point usually comes back as an address; a point in a park or on the water comes back as whatever is nearest in the corpus.

There is no cross-border reverse lookup. A coordinate outside Canada is `422` `outside_coverage`, and the corpus is not queried. An empty array means the point is inside Canada and nothing in the corpus is near it.

The [Geocoding API](/docs/apis/geocoding) documents the reverse endpoint.
