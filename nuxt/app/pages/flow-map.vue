<script setup lang="ts">
/**
 * /flow-map: the migration flow map block as a Nuxt page, full-bleed (the block keeps its own
 * gutter). The key comes from NUXT_PUBLIC_UNMAP_KEY in .env, which Nuxt hands to the page only
 * through declared runtime config. `unmap add` writes both: the empty NUXT_PUBLIC_UNMAP_KEY line in
 * .env and `runtimeConfig: { public: { unmapKey: "" } }` in nuxt.config. Paste your key and restart
 * the dev server; installed another way, add both yourself.
 */
import { useHead, useRuntimeConfig } from "#imports";
import { UnmapFlowMap } from "@/components/ui/flow-map";

useHead({ title: "Follow interprovincial migration" });
const apiKey = String(useRuntimeConfig().public.unmapKey ?? "");
</script>

<template>
  <main class="h-dvh">
    <UnmapFlowMap :api-key="apiKey" class="h-full" />
  </main>
</template>
