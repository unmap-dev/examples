<script setup lang="ts">
/**
 * /address-playground: the address playground block as a Nuxt page, full-bleed (the block keeps
 * its own gutter). There is no map on it, only search. The key comes from NUXT_PUBLIC_UNMAP_KEY in
 * .env, which Nuxt hands to the page only through declared runtime config. `unmap add` writes
 * both: the empty NUXT_PUBLIC_UNMAP_KEY line in .env and `runtimeConfig: { public: { unmapKey: "" } }`
 * in nuxt.config. Paste your key and restart the dev server; installed another way, add both yourself.
 */
import { useHead, useRuntimeConfig } from "#imports";
import { UnmapAddressPlayground } from "@/components/ui/address-playground";

useHead({ title: "Look up any place in Canada" });
const apiKey = String(useRuntimeConfig().public.unmapKey ?? "");
</script>

<template>
  <main class="h-dvh">
    <UnmapAddressPlayground :api-key="apiKey" class="h-full" />
  </main>
</template>
