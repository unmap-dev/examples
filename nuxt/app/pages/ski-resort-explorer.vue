<script setup lang="ts">
/**
 * /ski-resort-explorer: the ski resort explorer block as a Nuxt page, full-bleed (the block keeps
 * its own gutter). The key comes from NUXT_PUBLIC_UNMAP_KEY in .env, which Nuxt hands to the page
 * only through declared runtime config. `unmap add` writes both: the empty NUXT_PUBLIC_UNMAP_KEY
 * line in .env and `runtimeConfig: { public: { unmapKey: "" } }` in nuxt.config. Paste your key and
 * restart the dev server; installed another way, add both yourself. The ski areas need the Ski
 * add-on; without it the page says why.
 */
import { useHead, useRuntimeConfig } from "#imports";
import { UnmapSkiResortExplorer } from "@/components/ui/ski-resort-explorer";

useHead({ title: "Explore Canada's ski areas" });
const apiKey = String(useRuntimeConfig().public.unmapKey ?? "");
</script>

<template>
  <main class="h-dvh">
    <UnmapSkiResortExplorer :api-key="apiKey" class="h-full" />
  </main>
</template>
