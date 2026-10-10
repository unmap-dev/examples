---
title: Autocomplete as you type
description: Type-ahead suggestions from a partial query, for a search box.
category: geocoding
order: 11
---

# Autocomplete as you type

Autocomplete is the type-ahead endpoint. Fire it on each keystroke. It matches genuine partial prefixes: `Calgar` finds Calgary, `rue sainte-cath` finds rue Sainte-Catherine.

<LiveExample kind="autocomplete" query="rue sainte-cath" limit="5" lang="fr" center="-73.5673,45.5017" />

Send the whole input box, not the last word. Every word but the last must match a token in full and the last is treated as the prefix still being typed. Input of three characters or fewer answers with localities, provinces, and points of interest only; addresses and streets come back at the fourth character.

Autocomplete ranks more crudely than search: no exact-name bonus, no typo tolerance. Use `search` when you want the best single answer and autocomplete when you want fast suggestions. Autocomplete takes no `bbox`.

The [Geocoding API](/docs/apis/geocoding) covers the ranking difference in full.
