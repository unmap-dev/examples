<script setup lang="ts">
/**
 * <UnmapTreatyContext> - historic/modern treaty toggles and an accessible details panel, in Vue.
 *
 * Pair with a map composed with `:overlays="['treaties']"`: the style draws the treaty shapes, and
 * this component shows or hides the two categories and answers "which treaty records are at this
 * point" from the geocoder's full-resolution lookup (`createTreatyOverlay` in `@unmap/geocoding`). A map
 * click, a `point` prop (wire a geocoder selection to it) or the coordinate form each make one
 * reverse geocode call; mounting and toggling make none.
 *
 * A match is a spatial match to a published representation, not a determination of rights, title
 * or territory. No match means "no record in this dataset", and the copy says exactly that.
 *
 * Built on your shadcn-vue Field, Input, Button, Alert, Badge and Switch. Copied into your project
 * by `npx shadcn-vue add` or `unmap add`. Edit freely.
 * Import it as `import { UnmapTreatyContext } from "@/components/ui/treaty-context"`; Nuxt
 * auto-imports it as `<UiUnmapTreatyContext>` through shadcn-nuxt.
 */

import { computed, nextTick, reactive, ref, shallowRef, useId, watch, type HTMLAttributes } from "vue";
import {
  Geocoder as GeocoderClient,
  createTreatyOverlay,
  type TreatyContext as TreatyContextData,
  type TreatyLookupClient,
  type TreatyMatch,
  type TreatyOverlayController,
  type TreatySelection,
} from "@unmap/geocoding";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMap } from "@/lib/map-context";
import { cn } from "@/lib/utils";

/* treaty-context:shared:start */
type Lang = "en" | "fr";
type Category = "historic" | "modern";

const CATEGORIES: readonly Category[] = ["historic", "modern"];

/**
 * Interface copy. Title, no match, unavailable, notice and point scope are the contract's strings,
 * verbatim (docs/indigenous-context/contract.md, "Interface copy"). None of it names a territory,
 * ownership or an acknowledgement; keep it that way when you edit.
 */
const COPY = {
  en: {
    title: "Treaty context",
    noMatch:
      "No treaty record found in this dataset. This does not determine Indigenous rights or whether land is unceded.",
    unavailable: "Treaty context is temporarily unavailable.",
    notice:
      "Source representations are approximate or illustrative. Coverage is incomplete; consult the linked sources.",
    pointScope: "Context applies to this coordinate.",
    attribution:
      "Source: Crown-Indigenous Relations and Northern Affairs Canada (Open Government Licence – Canada)",
    layers: "Show on map",
    historic: "Historic",
    modern: "Modern",
    coordinates: "Look up a coordinate",
    longitude: "Longitude",
    latitude: "Latitude",
    lookUp: "Look up",
    invalidPoint: "Enter a longitude from -180 to 180 and a latitude from -90 to 90.",
    reload: "Reload map",
    loading: "Looking up treaty context.",
    found: (count: number) => (count === 1 ? "1 treaty record found." : `${count} treaty records found.`),
    hiddenOnMap: "hidden on map",
    category: "Category",
    subtype: "Subtype",
    geography: "Geography",
    representation: "Representation",
    record: "Record",
    source: "Source",
    sourceLink: "Dataset page",
    version: "Dataset version",
    // English sets a colon tight; French (OQLF) puts a non-breaking space before it.
    labelSeparator: ":",
    point: (lat: string, lng: string) => `Latitude ${lat}, longitude ${lng}`,
    inLanguage: { en: "(English)", fr: "(French)" },
    categories: { historic: "Historic", modern: "Modern" },
    kinds: {
      treaty_area: "Treaty area",
      overall_treaty_area: "Overall treaty area",
      settlement_land: "Settlement land",
      rights_area: "Rights area",
      other: "Other",
      unspecified: "Unspecified",
    },
    representations: { approximate: "Approximate", illustrative: "Illustrative", unspecified: "Unspecified" },
  },
  fr: {
    title: "Contexte des traités",
    noMatch:
      "Aucun traité trouvé dans ce jeu de données. Ce résultat ne détermine ni les droits autochtones ni si le territoire est non cédé.",
    unavailable: "Le contexte des traités est temporairement indisponible.",
    notice:
      "Les représentations des sources sont approximatives ou illustratives. La couverture est incomplète; consultez les sources indiquées.",
    pointScope: "Le contexte s’applique à ces coordonnées.",
    attribution:
      "Source : Relations Couronne-Autochtones et Affaires du Nord Canada (Licence du gouvernement ouvert – Canada)",
    layers: "Afficher sur la carte",
    historic: "Historiques",
    modern: "Modernes",
    coordinates: "Rechercher des coordonnées",
    longitude: "Longitude",
    latitude: "Latitude",
    lookUp: "Rechercher",
    invalidPoint: "Entrez une longitude de -180 à 180 et une latitude de -90 à 90.",
    reload: "Recharger la carte",
    loading: "Recherche du contexte des traités.",
    found: (count: number) => (count === 1 ? "1 traité trouvé." : `${count} traités trouvés.`),
    hiddenOnMap: "masqué sur la carte",
    category: "Catégorie",
    subtype: "Sous-type",
    geography: "Géographie",
    representation: "Représentation",
    record: "Fiche",
    source: "Source",
    sourceLink: "Page du jeu de données",
    version: "Version du jeu de données",
    labelSeparator: "\u00a0:",
    point: (lat: string, lng: string) => `Latitude ${lat}, longitude ${lng}`,
    inLanguage: { en: "(anglais)", fr: "(français)" },
    categories: { historic: "Historique", modern: "Moderne" },
    kinds: {
      treaty_area: "Zone du traité",
      overall_treaty_area: "Zone globale du traité",
      settlement_land: "Terres visées par l’entente",
      rights_area: "Zone d’exercice des droits",
      other: "Autre",
      unspecified: "Non précisée",
    },
    representations: { approximate: "Approximative", illustrative: "Illustrative", unspecified: "Non précisée" },
  },
} as const;

/** An http(s) publisher link, or nothing: `javascript:`, `data:` and malformed URLs never render. */
function safeHref(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** A typed coordinate: a plain decimal (a comma decimal separator is accepted), finite, within `limit`. */
function parseDegrees(raw: string, limit: number): number | undefined {
  const text = raw.trim().replace(",", ".");
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : undefined;
}

function degrees(value: number): string {
  return value.toFixed(5);
}

/** The language a subtype label is in. `subtype` follows the same rule as `name`. */
function subtypeLang(match: TreatyMatch, lang: Lang): Lang {
  const other: Lang = lang === "fr" ? "en" : "fr";
  return match.subtypes?.[lang]?.trim() ? lang : match.subtypes?.[other]?.trim() ? other : lang;
}

/** The drawn dataset version was retired: say unavailable and offer a reload, never newer details. */
function versionGone(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "treaties_version_not_found";
}
/* treaty-context:shared:end */

type View =
  | { kind: "idle" }
  | { kind: "loading"; point: [number, number] }
  | { kind: "result"; context: TreatyContextData }
  | { kind: "error"; point: [number, number] | null; versionGone: boolean };

const props = withDefaults(
  defineProps<{
    /** unmap API key. A geocoder client is created from it unless you pass `geocoder`. */
    apiKey?: string;
    /** Gateway base URL. Defaults to the unmap production gateway. */
    gateway?: string;
    /** An existing client with `reverse`, such as `unmap.geocoder`. Wins over `apiKey`. */
    geocoder?: TreatyLookupClient;
    /** Map id when multiple maps share a page. Defaults to "default". */
    mapId?: string;
    /** Interface and lookup language. Defaults to "en". */
    lang?: Lang;
    /** Look up this [lng, lat]: wire a geocoder selection here. Each new value is one lookup. */
    point?: [number, number];
    /** Historic treaties start visible. Defaults to true. */
    historic?: boolean;
    /** Modern treaties start visible. Defaults to true. */
    modern?: boolean;
    /**
     * The drawn dataset version was retired. Listen with `@reload` and reload the map (and with it
     * the overlay); the "Reload map" action only renders when a listener is attached. Declared as
     * a prop rather than an emit so the component can tell whether anyone is listening.
     */
    onReload?: () => void;
    class?: HTMLAttributes["class"];
  }>(),
  { lang: "en", historic: true, modern: true },
);
const emit = defineEmits<{
  /**
   * Every answer the lookup delivers (a map click, `point`, or typed coordinates): the treaty
   * context, the record ids drawn under the point, and the hidden categories. Highlight the
   * matched records with `context.matches[].id`. Makes no request of its own.
   */
  select: [selection: TreatySelection];
  /**
   * A lookup failed (a network error, a gateway error, a point outside coverage, a retired dataset
   * version), with the point it was for, so a caller can say so beside its own answer. The panel
   * shows "unavailable" either way. Makes no request of its own.
   */
  error: [error: Error & { code?: string }, point: [number, number] | null];
}>();

const copy = computed(() => COPY[props.lang]);
const map = useMap(() => props.mapId);
const client = computed<TreatyLookupClient>(
  () => props.geocoder ?? new GeocoderClient({ key: props.apiKey ?? "", gateway: props.gateway }),
);

const uid = useId();
const headingId = `${uid}-heading`;
const lngId = `${uid}-lng`;
const latId = `${uid}-lat`;
const invalidId = `${uid}-invalid`;

const view = shallowRef<View>({ kind: "idle" });
const visibility = reactive({ historic: props.historic, modern: props.modern });
const controller = shallowRef<TreatyOverlayController | null>(null);
const lng = ref("");
const lat = ref("");
const invalid = reactive({ lng: false, lat: false });
const heading = ref<HTMLElement | null>(null);
let focusOnResult = false;
let lastPoint: [number, number] | null = null;
// The `point` prop last asked for, so a re-render or a rebuilt controller never asks it again.
let askedPoint: string | null = null;

// One overlay controller per map and client. It makes no request until a lookup is asked for.
watch(
  [map, client],
  ([current, lookupClient], _previous, onCleanup) => {
    if (!current) return;
    const created = createTreatyOverlay(current, lookupClient, {
      historic: visibility.historic,
      modern: visibility.modern,
      lang: props.lang,
      onSelect: (selection) => {
        view.value = { kind: "result", context: selection.context };
        emit("select", selection);
      },
      onError: (error) => {
        view.value = { kind: "error", point: lastPoint, versionGone: versionGone(error) };
        emit("error", error, lastPoint);
      },
    });
    // The controller answers the click itself; this listener only shows that it started.
    const onClick = (event: { lngLat: { lng: number; lat: number } }) => {
      const at: [number, number] = [event.lngLat.lng, event.lngLat.lat];
      lastPoint = at;
      focusOnResult = false;
      view.value = { kind: "loading", point: at };
    };
    current.on("click", onClick);
    controller.value = created;
    onCleanup(() => {
      current.off("click", onClick);
      created.destroy();
      controller.value = null;
    });
  },
  { immediate: true },
);

watch(
  () => props.lang,
  (lang) => controller.value?.setLanguage(lang),
);

function lookup(at: [number, number], fromKeyboard: boolean) {
  const current = controller.value;
  if (!current) return;
  lastPoint = at;
  focusOnResult = fromKeyboard;
  view.value = { kind: "loading", point: at };
  void current.lookupAt(at);
}

// A new `point` is one lookup, once the controller exists. The same point is not asked twice in
// a row, not even by a controller rebuilt after a click moved the panel on; once `point` is
// cleared and set again, it is asked again.
// Getters, not the shallowRef itself: a shallowRef source re-runs the callback on every render
// of `point`, and a re-render must never re-ask after a click moved the panel on.
watch(
  [() => controller.value, () => (props.point ? `${props.point[0]},${props.point[1]}` : null)],
  ([current, key]) => {
    if (key === null) askedPoint = null;
    if (!current || !props.point || key === askedPoint) return;
    askedPoint = key;
    lookup(props.point, false);
  },
  { immediate: true },
);

// After a keyboard lookup settles, move focus to the panel heading.
watch(view, async (next) => {
  if (!focusOnResult || next.kind === "loading" || next.kind === "idle") return;
  focusOnResult = false;
  await nextTick();
  heading.value?.focus();
});

function toggle(category: Category, visible: boolean) {
  visibility[category] = visible;
  controller.value?.setVisibility({ [category]: visible });
}

function edit(field: "lng" | "lat", value: string | number) {
  if (field === "lng") lng.value = String(value);
  else lat.value = String(value);
  invalid[field] = false;
}

function submit() {
  const x = parseDegrees(lng.value, 180);
  const y = parseDegrees(lat.value, 90);
  invalid.lng = x === undefined;
  invalid.lat = y === undefined;
  if (x === undefined || y === undefined) return;
  lookup([x, y], true);
}

const result = computed(() => (view.value.kind === "result" ? view.value.context : null));
const matches = computed(() => (result.value?.status === "ok" ? result.value.matches : []));
const empty = computed(() => result.value?.status === "ok" && result.value.matches.length === 0);
const unavailable = computed(() => result.value?.status === "unavailable" || view.value.kind === "error");
const offerReload = computed(() => view.value.kind === "error" && view.value.versionGone && !!props.onReload);

const shown = computed<[number, number] | null>(() => {
  const current = view.value;
  if (current.kind === "result") return [current.context.point.lng, current.context.point.lat];
  return current.kind === "idle" ? null : current.point;
});

const announcement = computed(() => {
  const current = view.value;
  if (current.kind === "loading") return copy.value.loading;
  if (current.kind === "error") return copy.value.unavailable;
  if (current.kind === "idle") return "";
  if (current.context.status === "unavailable") return copy.value.unavailable;
  const count = current.context.matches.length;
  return count === 0 ? copy.value.noMatch : copy.value.found(count);
});

function kindLabel(match: TreatyMatch): string {
  return copy.value.kinds[match.geography_kind] ?? match.geography_kind;
}

function representationLabel(match: TreatyMatch): string {
  return copy.value.representations[match.representation] ?? match.representation;
}
</script>

<template>
  <section
    :aria-labelledby="headingId"
    :class="cn('flex w-full min-w-0 flex-col gap-4 text-sm', props.class)"
    data-unmap-treaty-context=""
    :lang="props.lang"
  >
    <fieldset class="flex min-w-0 flex-col gap-2" data-unmap-treaty-layers="">
      <legend class="mb-2 font-medium">{{ copy.layers }}</legend>
      <Field v-for="category in CATEGORIES" :key="category" orientation="horizontal">
        <Switch
          :id="`${uid}-${category}`"
          :model-value="visibility[category]"
          @update:model-value="toggle(category, $event)"
        />
        <FieldLabel :for="`${uid}-${category}`">{{ copy[category] }}</FieldLabel>
      </Field>
    </fieldset>

    <form
      :aria-label="copy.coordinates"
      class="flex min-w-0 flex-col gap-3"
      data-unmap-treaty-lookup=""
      novalidate
      @submit.prevent="submit"
    >
      <div class="grid min-w-0 grid-cols-2 gap-3">
        <Field :data-invalid="invalid.lng || undefined">
          <FieldLabel :for="lngId">{{ copy.longitude }}</FieldLabel>
          <Input
            :id="lngId"
            :model-value="lng"
            inputmode="decimal"
            autocomplete="off"
            :aria-invalid="invalid.lng"
            :aria-describedby="invalid.lng || invalid.lat ? invalidId : undefined"
            @update:model-value="edit('lng', $event)"
          />
        </Field>
        <Field :data-invalid="invalid.lat || undefined">
          <FieldLabel :for="latId">{{ copy.latitude }}</FieldLabel>
          <Input
            :id="latId"
            :model-value="lat"
            inputmode="decimal"
            autocomplete="off"
            :aria-invalid="invalid.lat"
            :aria-describedby="invalid.lng || invalid.lat ? invalidId : undefined"
            @update:model-value="edit('lat', $event)"
          />
        </Field>
      </div>
      <Alert v-if="invalid.lng || invalid.lat" :id="invalidId" variant="destructive" role="alert">
        <AlertDescription>{{ copy.invalidPoint }}</AlertDescription>
      </Alert>
      <Button type="submit" class="w-full" :disabled="!controller">{{ copy.lookUp }}</Button>
    </form>

    <div aria-live="polite" class="sr-only" role="status" data-unmap-treaty-status="">{{ announcement }}</div>

    <div class="flex min-w-0 flex-col gap-3" data-unmap-treaty-details="">
      <h3 :id="headingId" ref="heading" class="font-medium" tabindex="-1">{{ copy.title }}</h3>

      <p v-if="empty" data-unmap-treaty-empty="">{{ copy.noMatch }}</p>

      <Alert v-if="unavailable" data-unmap-treaty-unavailable="">
        <AlertDescription>
          <p>{{ copy.unavailable }}</p>
          <Button v-if="offerReload" type="button" variant="outline" size="sm" @click="props.onReload?.()">
            {{ copy.reload }}
          </Button>
        </AlertDescription>
      </Alert>

      <ul v-if="matches.length > 0" class="flex min-w-0 flex-col gap-3" data-unmap-treaty-matches="">
        <li
          v-for="match in matches"
          :key="match.id"
          class="flex min-w-0 flex-col gap-1.5 border-t pt-3"
          data-unmap-treaty-match=""
        >
          <p class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <span class="min-w-0 break-words font-medium" :lang="match.name_lang">{{ match.name }}</span>
            <span v-if="match.name_lang !== props.lang" class="text-muted-foreground text-xs" data-unmap-treaty-lang="">
              {{ copy.inLanguage[match.name_lang] }}
            </span>
            <Badge v-if="!visibility[match.category]" variant="outline" data-unmap-treaty-hidden="">
              {{ copy.hiddenOnMap }}
            </Badge>
          </p>
          <dl class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
            <dt class="text-muted-foreground">{{ copy.category }}</dt>
            <dd>{{ copy.categories[match.category] }}</dd>
            <template v-if="match.subtype">
              <dt class="text-muted-foreground">{{ copy.subtype }}</dt>
              <dd class="break-words">
                <span :lang="subtypeLang(match, props.lang)">{{ match.subtype }}</span>
                <span v-if="subtypeLang(match, props.lang) !== props.lang" class="text-muted-foreground text-xs">
                  {{ " " + copy.inLanguage[subtypeLang(match, props.lang)] }}
                </span>
              </dd>
            </template>
            <dt class="text-muted-foreground">{{ copy.geography }}</dt>
            <dd>{{ kindLabel(match) }}</dd>
            <dt class="text-muted-foreground">{{ copy.representation }}</dt>
            <dd>{{ representationLabel(match) }}</dd>
            <dt class="text-muted-foreground">{{ copy.record }}</dt>
            <dd class="break-all">{{ match.id }}</dd>
            <template v-if="safeHref(match.source_url)">
              <dt class="text-muted-foreground">{{ copy.source }}</dt>
              <dd>
                <a
                  class="underline underline-offset-4"
                  :href="safeHref(match.source_url)"
                  rel="noopener noreferrer"
                  target="_blank"
                >{{ copy.sourceLink }}</a>
              </dd>
            </template>
          </dl>
        </li>
      </ul>

      <div v-if="shown" data-unmap-treaty-point="">
        <p>{{ copy.pointScope }}</p>
        <p class="text-muted-foreground">{{ copy.point(degrees(shown[1]), degrees(shown[0])) }}</p>
      </div>
      <p v-if="result?.dataset_version" class="text-muted-foreground break-all">
        {{ copy.version }}{{ copy.labelSeparator }} {{ result.dataset_version }}
      </p>
      <p class="text-muted-foreground">{{ copy.notice }}</p>
      <p class="text-muted-foreground text-xs">{{ copy.attribution }}</p>
    </div>
  </section>
</template>
