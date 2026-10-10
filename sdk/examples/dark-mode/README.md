---
title: Dark mode
description: The same style, drawn for a dark page.
category: maps
order: 2
---

# Dark mode

A mode is `light` or `dark`. It is not a second style: the same `base` (or `muted`, or `outdoor`) has two renderings. Pass `mode: "dark"` when the rest of the page is dark.

<LiveExample kind="map" style="base" mode="dark" center="-114.0719,51.0447" zoom="11" />

Leave `mode` off and the gateway serves light. The live pane on this site does not follow the docs theme toggle, because a snippet whose text depended on a client-only preference would be a hydration mismatch. Flip the control above instead.

[Maps API](/docs/apis/maps) covers how mode is selected on the style URL.
