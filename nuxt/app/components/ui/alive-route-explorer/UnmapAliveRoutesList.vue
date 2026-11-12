<script setup lang="ts">
/**
 * The alive-route-explorer block's routes: the empty state, the search in flight, the failure with
 * a retry, what the search could not read, and the walks as radio rows (the pick, the fastest, then
 * the rest best first, three listed before "Show N more"). Hovering or focusing a row draws its walk
 * on the map. Installed beside the block. Edit freely.
 */
import { computed, shallowRef, useId } from "vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { describe } from "@/lib/alive-route-explorer/alive-signals";
import { ALIVE_COPY, pictureFor, requestError, walkNotes, type AliveLang, type AlivePictures, type RankedWalk, type Search } from "@/lib/alive-route-explorer/alive-view";
import UnmapAliveIllustration from "./UnmapAliveIllustration.vue";

const props = defineProps<{
  lang: AliveLang;
  search: Search;
  rows: RankedWalk[];
  pickId: string | null;
  fastestId: string | null;
  shownId: string | null;
  budget: number;
  pictures?: AlivePictures;
}>();
const emit = defineEmits<{
  select: [id: string];
  /** A row under the pointer or focus, to draw that walk on the map; null when it leaves. */
  hover: [id: string | null];
  retry: [];
}>();

/** Routes listed before "Show N more". */
const LISTED = 3;

const copy = computed(() => ALIVE_COPY[props.lang]);
const id = useId();
const all = shallowRef(false);
const result = computed(() => (props.search.state === "done" ? props.search.result : null));
const notes = computed(() => {
  if (!result.value) return [];
  const fastest = props.rows.find((row) => row.id === props.fastestId);
  return walkNotes(result.value, fastest?.distanceM ?? null, props.lang).notes;
});
// The pick, the fastest, then the rest best first, those you would take before those over your
// extra time or short on gain.
const ordered = computed(() => {
  const rank = (row: RankedWalk) => (row.id === props.pickId ? 0 : row.id === props.fastestId ? 1 : row.eligible ? 2 : 3);
  return [...props.rows].sort((a, b) => rank(a) - rank(b));
});
// The shown walk always stays listed, even when it ranks past the first three.
const listed = computed(() => (all.value ? ordered.value : ordered.value.filter((row, index) => index < LISTED || row.id === props.shownId)));
const hidden = computed(() => ordered.value.length - listed.value.length);
const items = computed(() =>
  listed.value.map((row) => {
    const isFastest = row.id === props.fastestId;
    const isPick = row.id === props.pickId;
    const reason = row.eligible || isFastest ? null : row.extraMin > props.budget + 1e-9 ? copy.value.overBudget : copy.value.underGain;
    const method = row.method === "detour" || row.method === "graph" ? copy.value.methods[row.method] : null;
    return {
      row,
      isFastest,
      title: isPick && !isFastest ? copy.value.livelier : isFastest ? copy.value.fastest : copy.value.another,
      reason,
      method,
      hint: [method, reason ?? describe(row.scores, props.lang, { basemap: result.value?.basemapAvailable ?? true })].filter(Boolean).join(". "),
      shown: row.id === props.shownId,
    };
  }),
);
const emptyPicture = computed(() => pictureFor({ kind: "quiet", places: [] }, props.pictures, "empty"));

function choose(value: unknown) {
  if (typeof value === "string") emit("select", value);
}
</script>

<template>
  <section class="flex flex-col gap-3" :aria-labelledby="id">
    <h3 :id="id" class="text-lg font-bold">{{ copy.routes }}</h3>
    <div v-if="search.state === 'idle'" class="flex items-center gap-3 rounded-xl border border-dashed p-3">
      <UnmapAliveIllustration kind="quiet" :lang="lang" :src="emptyPicture" :alt="copy.pictureAlt('quiet')" class="h-16 w-24 shrink-0 rounded-lg" />
      <p class="text-sm text-muted-foreground">{{ copy.empty }}</p>
    </div>
    <p v-if="search.state === 'loading'" aria-live="polite" class="flex items-center gap-2 py-3 text-sm text-muted-foreground">
      <Spinner class="size-4" />
      {{ copy.going }}
    </p>
    <Alert v-if="search.state === 'error'" variant="destructive" class="motion-safe:animate-in motion-safe:fade-in-0">
      <AlertTitle>{{ copy.errorTitle }}</AlertTitle>
      <AlertDescription class="flex flex-col items-start gap-2">
        <span>{{ requestError(search.error, lang) }}</span>
        <Button type="button" variant="outline" size="sm" @click="emit('retry')">{{ copy.retry }}</Button>
      </AlertDescription>
    </Alert>
    <Alert v-for="note in notes" :key="note" role="status">
      <AlertDescription>{{ note }}</AlertDescription>
    </Alert>
    <p v-if="result && pickId === fastestId && !result.tooShort" class="text-sm text-muted-foreground">{{ copy.alreadyLiveliest(budget) }}</p>
    <RadioGroup v-if="result" :aria-label="copy.routes" :model-value="shownId ?? undefined" class="gap-2" @update:model-value="choose" @mouseleave="emit('hover', null)">
      <label
        v-for="item in items"
        :key="item.row.id"
        :title="item.hint"
        :class="[
          'flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 text-base transition-colors motion-reduce:transition-none',
          item.shown ? 'border-2 border-primary bg-primary/10' : 'hover:bg-muted/60',
          item.reason ? 'opacity-60' : '',
        ]"
        @mouseenter="emit('hover', item.row.id)"
        @focusin="emit('hover', item.row.id)"
        @focusout="emit('hover', null)"
      >
        <RadioGroupItem :value="item.row.id" :data-route-id="item.row.id" />
        <span class="min-w-0 truncate font-semibold">{{ item.title }}</span>
        <!-- Below 400 px the row keeps the name and the time; the method moves to the row's title. -->
        <Badge v-if="item.method" variant="outline" class="h-5 shrink-0 px-1.5 text-[11px] max-[399px]:hidden">{{ item.method }}</Badge>
        <span v-if="item.reason" class="sr-only">{{ item.reason }}</span>
        <span class="ml-auto flex shrink-0 items-baseline gap-1.5 tabular-nums">
          <span :class="item.shown ? 'font-semibold text-primary' : 'font-medium'">{{ copy.minutes(item.row.durationS) }}</span>
          <span v-if="!item.isFastest" class="text-sm text-muted-foreground">{{ copy.extra(item.row.extraMin) }}</span>
        </span>
      </label>
    </RadioGroup>
    <Button v-if="result && (hidden > 0 || all) && ordered.length > LISTED" type="button" variant="link" class="h-auto w-fit px-0" @click="all = !all">
      {{ all ? copy.showFewer : copy.showMore(hidden) }}
    </Button>
  </section>
</template>
