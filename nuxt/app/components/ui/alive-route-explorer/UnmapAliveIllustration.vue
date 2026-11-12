<script setup lang="ts">
/**
 * <UnmapAliveIllustration> - five small scenes for what a walk passes: a park, the river, a street
 * of cafés, public art and a quiet residential street. Drawn, not photographed, and tagged
 * "Illustration" on the picture itself, so nobody takes one for the actual place. Every fill is one
 * of your theme's tokens (`primary`, `muted`, `muted-foreground`, `background`) at an opacity, so
 * the scenes follow your colours and your dark mode.
 *
 * Pass `src` (with `alt`) to show a picture instead. Either way it carries the visible
 * "Illustration" tag: pass only illustrations (drawn or AI-generated), never a photo presented as
 * the place. A picture that fails to load gives way to the drawn scene. Part of the
 * alive-route-explorer block; edit freely.
 */
import { computed, shallowRef, type HTMLAttributes } from "vue";

type IllustrationKind = "park" | "water" | "life" | "landmark" | "quiet";

const props = withDefaults(
  defineProps<{ kind: IllustrationKind; lang?: "en" | "fr"; src?: string; alt?: string; class?: HTMLAttributes["class"] }>(),
  { lang: "en", src: undefined, alt: undefined },
);

const DESCRIPTIONS: Record<"en" | "fr", Record<IllustrationKind, string>> = {
  en: {
    park: "Illustration: trees and a bench in a park",
    water: "Illustration: a riverbank path beside the water",
    life: "Illustration: a café terrace and a shop front",
    landmark: "Illustration: a sculpture on a plaza",
    quiet: "Illustration: houses on a quiet tree-lined street",
  },
  fr: {
    park: "Illustration : des arbres et un banc dans un parc",
    water: "Illustration : un sentier au bord de la rivière",
    life: "Illustration : une terrasse de café et une vitrine",
    landmark: "Illustration : une sculpture sur une place",
    quiet: "Illustration : des maisons sur une rue calme bordée d'arbres",
  },
};

const failed = shallowRef<string | null>(null);
const picture = computed(() => (props.src && failed.value !== props.src ? props.src : undefined));
const description = computed(() => DESCRIPTIONS[props.lang][props.kind]);
</script>

<template>
  <div :data-unmap-illustration="kind" :class="['relative overflow-hidden bg-muted', props.class]">
    <img v-if="picture" :src="picture" :alt="alt ?? description" loading="lazy" decoding="async" class="block size-full object-cover" @error="failed = picture ?? null" />
    <svg v-else role="img" :aria-label="description" viewBox="0 0 240 112" preserveAspectRatio="xMidYMid slice" class="block size-full">
      <template v-if="kind === 'park'">
        <rect y="78" width="240" height="34" class="fill-primary/25" />
        <path d="M0 100 C60 88 110 112 240 92 L240 98 C120 116 64 94 0 106Z" class="fill-background/70" />
        <rect x="45" y="52" width="6" height="34" class="fill-muted-foreground/50" />
        <circle cx="48" cy="44" r="26" class="fill-primary/55" />
        <rect x="181" y="50" width="6" height="34" class="fill-muted-foreground/50" />
        <circle cx="184" cy="38" r="30" class="fill-primary/45" />
        <rect x="117" y="56" width="5" height="26" class="fill-muted-foreground/50" />
        <circle cx="119" cy="44" r="17" class="fill-primary/70" />
        <rect x="88" y="78" width="34" height="4" class="fill-muted-foreground/60" />
        <rect x="91" y="82" width="3" height="8" class="fill-muted-foreground/60" />
        <rect x="116" y="82" width="3" height="8" class="fill-muted-foreground/60" />
        <rect x="88" y="70" width="34" height="3" class="fill-muted-foreground/60" />
      </template>
      <template v-else-if="kind === 'water'">
        <rect y="40" width="240" height="22" class="fill-primary/25" />
        <circle cx="30" cy="38" r="12" class="fill-primary/45" />
        <circle cx="58" cy="34" r="16" class="fill-primary/35" />
        <circle cx="200" cy="36" r="14" class="fill-primary/45" />
        <rect y="60" width="240" height="52" class="fill-primary/15" />
        <path d="M0 74c20 0 20-5 40-5s20 5 40 5 20-5 40-5 20 5 40 5 20-5 40-5 20 5 40 5" fill="none" stroke-width="2.5" class="stroke-primary/40" />
        <path d="M20 92c20 0 20-5 40-5s20 5 40 5 20-5 40-5 20 5 40 5 20-5 40-5" fill="none" stroke-width="2.5" class="stroke-primary/30" />
        <path d="M96 62 Q150 18 204 62" fill="none" stroke-width="5" class="stroke-muted-foreground/55" />
        <rect x="92" y="58" width="116" height="5" class="fill-muted-foreground/55" />
        <path d="M0 112 L0 98 C40 94 70 104 104 112Z" class="fill-muted-foreground/25" />
      </template>
      <template v-else-if="kind === 'life'">
        <rect y="92" width="240" height="20" class="fill-muted-foreground/20" />
        <rect x="18" y="30" width="112" height="62" class="fill-muted-foreground/30" />
        <rect x="28" y="52" width="40" height="32" class="fill-background/85" />
        <rect x="78" y="52" width="40" height="32" class="fill-background/85" />
        <path d="M12 30h124l-8 16H20Z" class="fill-primary/80" />
        <path d="M32 30l-4 16M54 30l-2 16M74 30v16M94 30l2 16M114 30l4 16" stroke-width="5" class="stroke-background/70" />
        <rect x="142" y="38" width="84" height="54" class="fill-muted-foreground/20" />
        <rect x="152" y="54" width="30" height="38" class="fill-background/85" />
        <rect x="190" y="54" width="26" height="22" class="fill-background/85" />
        <path d="M138 38h92l-6 10h-80Z" class="fill-primary/45" />
        <circle cx="40" cy="103" r="6" class="fill-muted-foreground/60" />
        <rect x="34" y="95" width="12" height="3" class="fill-muted-foreground/60" />
        <circle cx="96" cy="103" r="6" class="fill-muted-foreground/60" />
        <rect x="90" y="95" width="12" height="3" class="fill-muted-foreground/60" />
        <circle cx="222" cy="16" r="8" class="fill-primary/30" />
      </template>
      <template v-else-if="kind === 'landmark'">
        <rect y="84" width="240" height="28" class="fill-muted-foreground/25" />
        <rect y="22" width="56" height="62" class="fill-muted-foreground/15" />
        <rect x="164" y="10" width="76" height="74" class="fill-muted-foreground/20" />
        <rect x="176" y="22" width="10" height="12" class="fill-background/70" />
        <rect x="196" y="22" width="10" height="12" class="fill-background/70" />
        <rect x="216" y="22" width="10" height="12" class="fill-background/70" />
        <rect x="92" y="70" width="36" height="16" class="fill-muted-foreground/50" />
        <path d="M110 70C96 60 98 36 110 26c12 10 14 34 0 44Z" class="fill-primary/70" />
        <path d="M110 62c-14-2-24-12-26-22 12 0 22 8 26 22Zm0 0c14-2 24-12 26-22-12 0-22 8-26 22Z" class="fill-primary/45" />
        <circle cx="110" cy="22" r="6" class="fill-primary/70" />
      </template>
      <template v-else>
        <rect y="82" width="240" height="30" class="fill-muted-foreground/25" />
        <path d="M0 97h240" fill="none" stroke-width="2" stroke-dasharray="10 8" class="stroke-background/80" />
        <rect x="22" y="48" width="50" height="34" class="fill-muted-foreground/20" />
        <path d="M16 50 47 28 78 50Z" class="fill-primary/35" />
        <rect x="40" y="62" width="12" height="20" class="fill-background/80" />
        <rect x="150" y="44" width="58" height="38" class="fill-muted-foreground/20" />
        <path d="M144 46 179 22 214 46Z" class="fill-primary/35" />
        <rect x="160" y="56" width="12" height="12" class="fill-background/80" />
        <rect x="186" y="56" width="12" height="12" class="fill-background/80" />
        <rect x="104" y="58" width="5" height="26" class="fill-muted-foreground/50" />
        <circle cx="106" cy="48" r="16" class="fill-primary/55" />
        <rect x="226" y="60" width="4" height="24" class="fill-muted-foreground/50" />
        <circle cx="228" cy="52" r="11" class="fill-primary/45" />
      </template>
    </svg>
    <!-- The tag is part of the picture: a scene, never a photo of the place. -->
    <span aria-hidden="true" class="absolute top-2 left-2 rounded-full bg-background/85 px-2 py-0.5 text-[11px] leading-tight font-medium text-foreground">Illustration</span>
  </div>
</template>
