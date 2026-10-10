<script setup lang="ts">
/**
 * /delivery-tracker: the delivery tracker block as a Nuxt page, full-bleed (the block keeps its own
 * gutter). The key comes from NUXT_PUBLIC_UNMAP_KEY in .env, which Nuxt hands to the page only
 * through declared runtime config. `unmap add` writes both: the empty NUXT_PUBLIC_UNMAP_KEY line in
 * .env and `runtimeConfig: { public: { unmapKey: "" } }` in nuxt.config. Paste your key and restart
 * the dev server; installed another way, add both yourself.
 */
import { useHead, useRuntimeConfig } from "#imports";
import { UnmapDeliveryTracker } from "@/components/ui/delivery-tracker";

useHead({ title: "Track a delivery" });
const apiKey = String(useRuntimeConfig().public.unmapKey ?? "");
</script>

<template>
  <main class="h-dvh">
    <UnmapDeliveryTracker :api-key="apiKey" class="h-full" />
  </main>
</template>
