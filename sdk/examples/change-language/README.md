---
title: Change the map language
description: Choose among 41 map-label languages, including Japanese, Korean, and Chinese.
category: maps
order: 3
---

# Change the map language

`lang` selects a language the tiles carry. This map is centred on Montréal with French labels. Use `ja`, `ko`, `zh-Hans`, or `zh-Hant` for native Japanese, Korean, Simplified Chinese, or Traditional Chinese labels. Region tags such as `zh-TW` are accepted. Missing translations fall back to available local or English names.

<LiveExample kind="map" style="base" mode="light" lang="fr" center="-73.5673,45.5017" zoom="12" />

Indigenous names are not a language code. The tiles carry them on the feature (`name2`), so Iqaluit renders "Iqaluit / ᐃᖃᓗᐃᑦ" regardless of `lang`. Leave `lang` off and the gateway follows `Accept-Language`.

[Maps API](/docs/apis/maps) lists how labels are chosen.
