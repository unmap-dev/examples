<script setup lang="ts">
/**
 * /energy-explorer: the energy explorer block as a Nuxt page, full-bleed (the block keeps its own
 * gutter). The key comes from NUXT_PUBLIC_UNMAP_KEY in .env, which Nuxt hands to the page only
 * through declared runtime config. `unmap add` writes both: the empty NUXT_PUBLIC_UNMAP_KEY line
 * in .env and `runtimeConfig: { public: { unmapKey: "" } }` in nuxt.config. Paste your key and
 * restart the dev server; installed another way, add both yourself. The energy layers need the
 * Energy add-on; without it the page says why.
 */
import { useHead, useRuntimeConfig } from "#imports";
import { UnmapEnergyExplorer } from "@/components/ui/energy-explorer";

useHead({ title: "Explore Alberta's wells and pipelines" });
const apiKey = String(useRuntimeConfig().public.unmapKey ?? "");
</script>

<template>
  <main class="h-dvh">
    <UnmapEnergyExplorer :api-key="apiKey" class="h-full" />
  </main>
</template>
