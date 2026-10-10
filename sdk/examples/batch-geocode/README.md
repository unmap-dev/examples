---
title: Geocode many addresses
description: Send up to 100 searches in one POST. The answer is an array aligned to the input.
category: geocoding
order: 13
---

# Geocode many addresses

`POST /geocode/batch` is the same search as `GET /geocode/search`, many times, in one request. The response is an array of arrays: index `i` is what search would return for query `i`. Blank strings stay in place as `[]` and are not billed.

<CodeTabs labels="curl,TypeScript" group="request">

```bash
curl -X POST "https://api.unmap.dev/geocode/batch" \
  -H "Authorization: Bearer $UNMAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"queries":["17 Ave SW Calgary","Springfield",""],"limit":1}'
```

```ts
import { Geocoder } from "@unmap/geocoding";

const geocoder = new Geocoder({ key: "um_live_..." });
const results = await geocoder.batch(
  ["17 Ave SW Calgary", "Springfield", ""],
  { limit: 1 },
);
```

</CodeTabs>

```json
[
  [{ "id": "…", "name": "101 17 Avenue SW, Calgary", "layer": "address" }],
  [{ "id": "…", "name": "Springfield", "layer": "locality" }],
  []
]
```

A request holds 1 to 100 queries. More than 100 is a `413`. Shared controls only: the same `lang`, `limit`, `layers`, `focus`, `region`, and `bbox` as search. The client library chunks a longer list into requests of 100 and concatenates in input order.

Each non-blank query is one geocode increment, including a valid no-match. A 400, a 413, or a container failure increments nothing. If remaining monthly allowance is less than the number of non-blank queries, the whole request is refused.

This request is not a background job: it answers in the same HTTP call, and the file, if you have one, stays on your machine. For a CSV, `unmap geocode csv` is the client that already does this. If you would rather upload the file and have unmap run it, that is [hosted batch](/docs/apis/batch-geocoding#hosted-batch-in-the-dashboard) in the dashboard, which is session-authenticated and not reachable with an API key. The [Batch geocoding](/docs/apis/batch-geocoding) page covers all three.
