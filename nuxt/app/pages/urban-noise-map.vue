<script setup lang="ts">
/**
 * /urban-noise-map: the urban noise block as a Nuxt page, full-bleed (the block keeps its own
 * gutter). The key comes from NUXT_PUBLIC_UNMAP_KEY in .env, which Nuxt hands to the page only
 * through declared runtime config. `unmap add` writes both: the empty NUXT_PUBLIC_UNMAP_KEY line in
 * .env and `runtimeConfig: { public: { unmapKey: "" } }` in nuxt.config. Paste your key and
 * restart the dev server; installed another way, add both yourself. The noise data needs the Urban
 * Noise add-on; without it the page says why.
 */
import { useHead, useRuntimeConfig } from "#imports";
import { UnmapUrbanNoiseMap } from "@/components/ui/urban-noise-map";

useHead({ title: "Check how loud a street is" });
const apiKey = String(useRuntimeConfig().public.unmapKey ?? "");
</script>

<template>
  <main class="h-dvh">
    <UnmapUrbanNoiseMap :api-key="apiKey" class="h-full" />
  </main>
</template>
