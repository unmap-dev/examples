---
title: Apply a theme
description: Redraw the map with a colour treatment from the theme builder.
category: maps
order: 4
---

# Apply a theme

A theme is a colour treatment applied to a style, always a light + dark pair. It is data, not a stylesheet: it rides in the same request as everything else, and it wins over `style`.

<LiveExample kind="theme" theme="u4e" center="-114.0719,51.0447" zoom="12" />

`u4e` is a short code for a shipped theme preset. The [theme builder](/create) also exports long `ut1.` codes for a theme you composed yourself. Both go in the same option.

[Maps API](/docs/apis/maps) covers what a theme may carry.
