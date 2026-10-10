---
title: Canadian overlays
description: Compose a named catalog layer on a basemap with the overlays option.
category: maps
order: 9
---

# Canadian overlays

`overlays` names catalog layers on the style URL. They draw as palette-only lines and labels
above roads and below labels. This example asks for municipal boundaries, a core layer.

<LiveExample kind="map" style="base" overlays="municipalities" overlayChoices="municipalities,parks,aboriginal-lands,survey.dls,survey.nts,survey.geographic-township,survey.river-lots,survey.parcels" center="-114.0719,51.0447" zoom="8" />

`municipalities` overlay tiles are live. An id that is not in the catalog (`water`, `rail`) is a `400` on the style request; a missing
archive 404s on the tile and the basemap still renders. `GET /layers` lists every id, licence,
and coverage hole. Gated layers such as `survey.dls` need the `legal-land` add-on or
the style request is `403 addon_required`.

[Layers](/docs/overlays/layers) is the catalog. [Coverage](/docs/reference/coverage) is the honest map of
what is live.
