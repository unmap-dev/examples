<script setup lang="ts">
/**
 * The HTML the alive-route-explorer block pins to the map: the start and destination with their
 * names, a time bubble beside each walk, and up to three highlight cards placed so they cover
 * neither the walks, the panel nor each other, on a leader when they stand away from their marker.
 * A card with no room folds into its marker, which opens it as a popover (always, on a phone).
 * Placing waits for the map to be still; while it moves, everything keeps its offset from its
 * anchor. Sits inside <UnmapMap>. Installed beside the block. Edit freely.
 */
import { computed, onBeforeUnmount, onMounted, onUpdated, shallowRef, watch, type ComponentPublicInstance } from "vue";
import { Coffee, Landmark, Trees } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMap, useMapReady } from "@/lib/map-context";
import type { LngLat } from "@/lib/alive-route-explorer/alive-signals";
import {
  ALIVE_COPY,
  ALIVE_MAP_ID,
  TAIL_INSET,
  apexOf,
  densify,
  highlightCards,
  pictureFor,
  placeBox,
  placeCard,
  placeName,
  type AliveLang,
  type AlivePictures,
  type Point,
  type RankedWalk,
  type Rect,
  type Side,
} from "@/lib/alive-route-explorer/alive-view";
import UnmapAliveCardBody from "./UnmapAliveCardBody.vue";
import UnmapAliveEndPin from "./UnmapAliveEndPin.vue";
import UnmapAliveStartDot from "./UnmapAliveStartDot.vue";

const props = defineProps<{
  lang: AliveLang;
  /** The shown walk and the fastest, or null before a search. */
  shown: RankedWalk | null;
  fastest: RankedWalk | null;
  isPick: boolean;
  phone: boolean;
  from: { at: LngLat; label: string };
  to: { at: LngLat; label: string };
  pictures?: AlivePictures;
  /** The panel and the Why card, which the cards and bubbles stay clear of. */
  panel: () => HTMLElement | null;
  why: () => HTMLElement | null;
}>();
const emit = defineEmits<{
  select: [id: string];
  /** Some card found no room: the camera may give the walk more margin. */
  crowded: [];
}>();

/** A highlight card's size in pixels (w-55, a 140 px picture and a caption), for placing it. */
const CARD = { w: 220, h: 196 };
const BUBBLE = { pick: { w: 196, h: 70 }, fastest: { w: 150, h: 60 } };
const KIND_ICON = { park: Trees, life: Coffee, landmark: Landmark } as const;
/** The tail on a box's edge facing the point it points at. */
const TAIL: Record<Side, string> = {
  top: "-bottom-[7px] left-1/2 -translate-x-1/2 border-r-2 border-b-2",
  bottom: "-top-[7px] left-1/2 -translate-x-1/2 border-t-2 border-l-2",
  left: "top-1/2 -right-[7px] -translate-y-1/2 border-t-2 border-r-2",
  right: "top-1/2 -left-[7px] -translate-y-1/2 border-b-2 border-l-2",
  "top-left": "-bottom-[7px] right-[22px] border-r-2 border-b-2",
  "top-right": "-bottom-[7px] left-[22px] border-r-2 border-b-2",
  "bottom-left": "-top-[7px] right-[22px] border-t-2 border-l-2",
  "bottom-right": "-top-[7px] left-[22px] border-t-2 border-l-2",
};
/** Every side, in the order a card tries them: above first, as in the reference. */
const CARD_SIDES: readonly Side[] = ["top", "top-left", "top-right", "right", "left", "bottom", "bottom-left", "bottom-right"];
const BUBBLE_SIDES: readonly Side[] = ["top", "right", "left", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"];
/**
 * For the bubbles and the markers, Buttons whose left/top follow the map every frame: no
 * transition-all (they would trail the map by 150 ms), and no press nudge (it replaces the
 * centring translate).
 */
const TRACKS = "transition-colors active:not-aria-[haspopup]:translate-y-0";
const MARKER = `pointer-events-auto size-9 rounded-full border bg-card text-primary shadow-md hover:bg-card hover:text-primary dark:hover:bg-card ${TRACKS}`;

/** Where a placed box goes: at its anchor, offset by the tail's gap, so the tail meets the point whatever the box's real size. */
function boxStyle(spot: { at: Point; side: Side }, gap: number) {
  const { x, y } = spot.at;
  const at = (left: number, top: number, transform: string) => ({ left: `${left}px`, top: `${top}px`, transform });
  switch (spot.side) {
    case "top":
      return at(x, y - gap, "translate(-50%, -100%)");
    case "bottom":
      return at(x, y + gap, "translate(-50%, 0)");
    case "left":
      return at(x - gap, y, "translate(-100%, -50%)");
    case "right":
      return at(x + gap, y, "translate(0, -50%)");
    case "top-left":
      return at(x + TAIL_INSET, y - gap, "translate(-100%, -100%)");
    case "top-right":
      return at(x - TAIL_INSET, y - gap, "translate(0, -100%)");
    case "bottom-left":
      return at(x + TAIL_INSET, y + gap, "translate(-100%, 0)");
    case "bottom-right":
      return at(x - TAIL_INSET, y + gap, "translate(0, 0)");
  }
}
const place = (p: Point) => ({ left: `${p.x}px`, top: `${p.y}px` });

/** A rectangle of the page in the map's own pixels, or null when it is not on screen. */
function within(box: DOMRect, el: HTMLElement | null): Rect | null {
  const r = el?.getBoundingClientRect();
  return r && r.width > 0 ? { x0: r.left - box.left, y0: r.top - box.top, x1: r.right - box.left, y1: r.bottom - box.top } : null;
}

/** Points of a walk ordered from its middle outwards: the bubble's preferred anchors. */
function middleOut<T>(points: T[]): T[] {
  const inner = points.slice(Math.floor(points.length * 0.15), Math.ceil(points.length * 0.85));
  const step = Math.max(1, Math.floor(inner.length / 24));
  const picked = inner.filter((_, i) => i % step === 0);
  const mid = picked.length / 2;
  return picked.map((p, i) => ({ p, d: Math.abs(i - mid) })).sort((a, b) => a.d - b.d).map(({ p }) => p);
}

const copy = computed(() => ALIVE_COPY[props.lang]);
const map = useMap(ALIVE_MAP_ID);
const ready = useMapReady(ALIVE_MAP_ID);

// Re-render whenever the map moves, so HTML pinned to coordinates follows it; `settled` counts the
// moves that have ended (and resizes), for work that should wait until the map is still.
const tick = shallowRef(0);
const settled = shallowRef(0);
watch(
  [map, ready],
  ([live, isReady], _previous, onCleanup) => {
    if (!live || !isReady) return;
    const bump = () => (tick.value += 1);
    const settle = () => (settled.value += 1);
    live.on("move", bump);
    live.on("moveend", settle);
    live.on("resize", settle);
    onCleanup(() => {
      live.off("move", bump);
      live.off("moveend", settle);
      live.off("resize", settle);
    });
  },
  { immediate: true },
);

// Measured sizes of the boxes this overlay places, by key. Every render reads them for placing and
// then re-measures; a size that changed (a picture loaded, a font arrived, a longer name) places
// once more with the true size. The first placing uses estimates.
const sizes = new globalThis.Map<string, { w: number; h: number }>();
const nodes = new globalThis.Map<string, HTMLElement>();
const version = shallowRef(0);
const size = (key: string, fallback: { w: number; h: number }) => sizes.get(key) ?? fallback;
function measured(key: string) {
  return (target: Element | ComponentPublicInstance | null) => {
    const el = target instanceof HTMLElement ? target : ((target as ComponentPublicInstance | null)?.$el as HTMLElement | undefined);
    if (el instanceof HTMLElement) nodes.set(key, el);
    else nodes.delete(key);
  };
}
function measure() {
  let changed = false;
  for (const [key, el] of nodes) {
    // offsetWidth/Height ignore transforms, so an entry animation never shrinks the measure.
    const next = { w: el.offsetWidth, h: el.offsetHeight };
    const was = sizes.get(key);
    if (next.w > 0 && (!was || Math.abs(was.w - next.w) > 1 || Math.abs(was.h - next.h) > 1)) {
      sizes.set(key, next);
      changed = true;
    }
  }
  if (changed) version.value += 1;
}
onMounted(measure);
onUpdated(measure);

const cards = computed(() => (props.shown ? highlightCards(props.shown.coords, props.shown.scores, (poi) => placeName(poi, props.lang)) : []));
const closed = shallowRef<string[]>([]);
watch(
  () => props.shown?.id,
  () => {
    closed.value = [];
  },
);

// Each end's name sits to its right, or to its left when the right edge is too close.
function endsAt(project: (at: LngLat) => Point, width: number) {
  return [
    { ...props.from, kind: "start" as const, p: project(props.from.at) },
    { ...props.to, kind: "end" as const, p: project(props.to.at) },
  ].map((end) => {
    const pill = size(`pill-${end.kind}`, { w: 28 + end.label.length * 9, h: 36 });
    const flip = end.p.x + 20 + pill.w > width - 8;
    const x0 = flip ? end.p.x - 20 - pill.w : end.p.x + 20;
    const y0 = end.kind === "start" ? end.p.y - pill.h / 2 : end.p.y - 40;
    return { ...end, flip, pill: { x0, y0, x1: x0 + pill.w, y1: y0 + pill.h } };
  });
}

/** The overlay's placements, made when the map is still and kept, relative to their anchors, while it moves. */
interface Layout {
  bubbles: { key: "pick" | "fastest"; at: LngLat; side: Side }[];
  /** By card index: null when closed by the reader, "folded" when nothing fits, else its spot relative to its marker. */
  cards: (null | "folded" | { dx: number; dy: number; side?: Side; leader?: { x0: number; y0: number; x1: number; y1: number } })[];
}

function placeAll(): Layout | null {
  const live = map.value;
  const { shown, fastest, phone } = props;
  if (!live || !ready.value || !shown || !fastest) return null;
  const project = ([lng, lat]: LngLat): Point => live.project({ lng, lat });
  const box = live.getContainer().getBoundingClientRect();
  const bounds: Rect = { x0: 8, y0: 8, x1: box.width - 8, y1: box.height - 8 };
  const obstacles: Rect[] = [];
  for (const el of [props.panel(), props.why()]) {
    const r = within(box, el);
    if (r) obstacles.push({ ...r, weight: 20 });
  }
  for (const end of endsAt(project, box.width)) {
    obstacles.push(end.pill);
    obstacles.push(end.kind === "start" ? { x0: end.p.x - 12, y0: end.p.y - 12, x1: end.p.x + 12, y1: end.p.y + 12 } : { x0: end.p.x - 14, y0: end.p.y - 42, x1: end.p.x + 14, y1: end.p.y + 2 });
  }
  const markers = cards.value.map((card) => project(card.at));
  const markerRects: Rect[] = markers.map((m) => ({ x0: m.x - 18, y0: m.y - 18, x1: m.x + 18, y1: m.y + 18 }));
  obstacles.push(...markerRects);
  const shownLine = shown.coords.map(project);
  const fastestLine = fastest.id !== shown.id ? fastest.coords.map(project) : [];
  const lines = densify([shownLine, fastestLine], 12);
  const pickPoints = densify([shownLine], 12);

  // Bubbles first: they say the times, the reason the walks are there. Cards then avoid them.
  const bubbles: Layout["bubbles"] = [];
  const bubble = (key: "pick" | "fastest", coords: LngLat[], first: LngLat[]) => {
    const lngLats = [...first, ...middleOut(coords)];
    const anchors = lngLats.map(project);
    const spot = placeBox(anchors, size(`bubble-${key}`, BUBBLE[key]), BUBBLE_SIDES, obstacles, lines, bounds, 14);
    if (!spot) return;
    obstacles.push(spot.rect);
    bubbles.push({ key, at: lngLats[anchors.indexOf(spot.at)]!, side: spot.side });
  };
  if (fastest.id === shown.id) bubble("pick", shown.coords, []);
  else {
    bubble("pick", shown.coords, [apexOf(shown.coords, fastest.coords)]);
    bubble("fastest", fastest.coords, []);
  }

  // Cards: each on a ring round its marker, clear of everything above and of each other; a card
  // with no such spot folds into its marker, which opens it as a popover.
  const placed: Layout["cards"] = cards.value.map((card, index) => {
    if (phone || closed.value.includes(card.kind)) return null;
    const m = markers[index]!;
    const others = obstacles.filter((o) => o !== markerRects[index]);
    const spot = placeCard(m, size(`card-${card.kind}`, CARD), CARD_SIDES, others, pickPoints, bounds);
    if (!spot) return "folded";
    obstacles.push(spot.rect);
    return {
      dx: spot.rect.x0 - m.x,
      dy: spot.rect.y0 - m.y,
      ...(spot.side ? { side: spot.side } : {}),
      ...(spot.leader ? { leader: { x0: spot.leader.x0 - m.x, y0: spot.leader.y0 - m.y, x1: spot.leader.x1 - m.x, y1: spot.leader.y1 - m.y } } : {}),
    };
  });
  return { bubbles, cards: placed };
}

// Placing waits for the map to be still: a new walk, a size measured, a move or zoom ended. The
// map is read at that moment, on purpose: placing on every frame would fold and unfold cards
// mid-gesture.
const layout = shallowRef<Layout | null>(null);
watch(
  [map, ready, settled, () => props.shown, () => props.fastest, cards, () => props.phone, closed, version, () => props.from.label, () => props.to.label],
  () => {
    layout.value = placeAll();
  },
  { immediate: true, flush: "post" },
);

// A walk is "crowded" only once the camera has framed it (a move has ended since it arrived): the
// first layout runs against the previous camera, where a card folding says nothing. Once per walk.
const walkKey = computed(() => (props.shown ? `${props.shown.id}|${props.shown.coords.length}|${props.shown.coords[0]?.join(",")}` : ""));
const crowded = computed(() => !!layout.value && layout.value.cards.some((c) => c === "folded"));
let arrived = { walk: "", settled: -1 };
const reported = new Set<string>();
watch(
  [crowded, walkKey, settled],
  ([isCrowded, walk, count]) => {
    if (arrived.walk !== walk) arrived = { walk, settled: count };
    if (!isCrowded || !walk || count <= arrived.settled || reported.has(walk)) return;
    reported.add(walk);
    emit("crowded");
  },
  { immediate: true, flush: "post" },
);

// What the template draws, again on every frame of a move.
const view = computed(() => {
  void tick.value;
  void version.value;
  const live = map.value;
  if (!live || !ready.value) return null;
  const project = ([lng, lat]: LngLat): Point => live.project({ lng, lat });
  const box = live.getContainer().getBoundingClientRect();
  const placed = layout.value;
  const walkId = props.shown?.id ?? "";
  return {
    ends: endsAt(project, box.width),
    cards: cards.value.map((card, index) => {
      const spot = placed?.cards[index];
      return {
        card,
        key: `${card.kind}-${card.names[0]}`,
        at: project(card.at),
        spot: spot && spot !== "folded" ? spot : null,
        folded: props.phone || spot === "folded",
        picture: pictureFor(card, props.pictures, walkId),
        name: `${copy.value.highlights[card.kind]}: ${card.names.join(", ")}`,
        icon: KIND_ICON[card.kind],
      };
    }),
    bubbles: props.shown && props.fastest ? (placed?.bubbles ?? []).map((b) => ({ ...b, style: boxStyle({ at: project(b.at), side: b.side }, 14) })) : [],
  };
});
const isFastest = computed(() => !!props.shown && !!props.fastest && props.shown.id === props.fastest.id);

function toggle(kind: string) {
  closed.value = closed.value.includes(kind) ? closed.value.filter((k) => k !== kind) : [...closed.value, kind];
}
function pickBubble(key: "pick" | "fastest") {
  const id = key === "pick" ? props.shown?.id : props.fastest?.id;
  if (id) emit("select", id);
}
onBeforeUnmount(() => nodes.clear());
</script>

<template>
  <!-- overflow-clip, not overflow-hidden: focusing a marker near the edge must not scroll this layer off the map underneath it. -->
  <div v-if="view" class="pointer-events-none absolute inset-0 z-[5] overflow-clip">
    <div v-for="end in view.ends" :key="end.kind" :style="place(end.p)" class="absolute">
      <UnmapAliveStartDot v-if="end.kind === 'start'" class="absolute size-5 -translate-x-1/2 -translate-y-1/2" />
      <UnmapAliveEndPin v-else class="absolute h-10 -translate-x-1/2 -translate-y-full" />
      <span
        :ref="measured(`pill-${end.kind}`)"
        :class="[
          'absolute rounded-xl bg-card px-3 py-1.5 text-base font-bold whitespace-nowrap text-card-foreground shadow-md',
          end.flip ? 'right-5' : 'left-5',
          end.kind === 'start' ? 'top-0 -translate-y-1/2' : '-top-10',
        ]"
      >
        {{ end.label }}
      </span>
    </div>

    <!-- Leaders, from a marker's rim to its card, under both. -->
    <svg aria-hidden="true" class="absolute inset-0 size-full overflow-visible">
      <template v-for="item in view.cards" :key="item.key">
        <line
          v-if="item.spot?.leader"
          :x1="item.at.x + item.spot.leader.x0"
          :y1="item.at.y + item.spot.leader.y0"
          :x2="item.at.x + item.spot.leader.x1"
          :y2="item.at.y + item.spot.leader.y1"
          stroke-width="2"
          stroke-dasharray="3 4"
          stroke-linecap="round"
          class="stroke-foreground/50"
        />
      </template>
    </svg>

    <!-- The wrapper centres the marker, so the button's own press nudge never moves it off its point. -->
    <div v-for="item in view.cards" :key="item.key" :style="place(item.at)" class="absolute">
      <div class="absolute -translate-x-1/2 -translate-y-1/2">
        <Popover v-if="item.folded">
          <PopoverTrigger as-child>
            <Button type="button" variant="ghost" size="icon" :aria-label="item.name" :class="MARKER">
              <component :is="item.icon" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" :side-offset="10" class="w-56 gap-0 overflow-hidden rounded-2xl p-0">
            <UnmapAliveCardBody :lang="lang" :card="item.card" :picture="item.picture" />
          </PopoverContent>
        </Popover>
        <Button v-else type="button" variant="ghost" size="icon" :aria-label="item.name" :aria-expanded="!!item.spot" :class="MARKER" @click="toggle(item.card.kind)">
          <component :is="item.icon" aria-hidden="true" />
        </Button>
      </div>
    </div>
    <!-- Kept at its offset from the marker while the map moves, so card and marker move as one. -->
    <template v-for="item in view.cards" :key="`card-${item.key}`">
      <Card
        v-if="item.spot"
        :ref="measured(`card-${item.card.kind}`)"
        :data-unmap-card="item.card.kind"
        class="pointer-events-auto absolute w-55 gap-0 overflow-visible rounded-2xl py-0 shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300"
        :style="{ left: `${item.at.x + item.spot.dx}px`, top: `${item.at.y + item.spot.dy}px` }"
      >
        <div class="overflow-hidden rounded-2xl">
          <UnmapAliveCardBody :lang="lang" :card="item.card" :picture="item.picture" />
        </div>
        <span v-if="item.spot.side" aria-hidden="true" :class="['absolute size-3 rotate-45 border-inherit border-transparent bg-card', TAIL[item.spot.side]]" />
      </Card>
    </template>

    <Button
      v-for="bubble in view.bubbles"
      :key="bubble.key"
      :ref="measured(`bubble-${bubble.key}`)"
      type="button"
      variant="ghost"
      :style="bubble.style"
      :class="[
        'pointer-events-auto absolute h-auto flex-col items-start gap-0.5 overflow-visible rounded-2xl border-2 bg-card px-4 py-2 text-left whitespace-nowrap shadow-lg hover:bg-card dark:hover:bg-card',
        TRACKS,
        bubble.key === 'pick' ? 'border-primary text-primary hover:text-primary' : 'border-border text-foreground hover:text-foreground',
        bubble.key === 'pick' ? 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300' : '',
      ]"
      @click="pickBubble(bubble.key)"
    >
      <template v-if="bubble.key === 'pick' && shown">
        <span class="block text-lg leading-tight font-semibold">{{ isFastest ? copy.fastest : isPick ? copy.livelier : copy.selected }}</span>
        <span class="block leading-tight tabular-nums">
          <span class="text-xl font-bold">{{ copy.minutes(shown.durationS) }}</span>
          <span v-if="!isFastest" class="text-sm font-medium"> ({{ copy.extra(shown.extraMin) }})</span>
        </span>
      </template>
      <template v-else-if="fastest">
        <span class="block text-base leading-tight font-semibold">{{ copy.fastest }}</span>
        <span class="block text-base leading-tight tabular-nums">{{ copy.minutes(fastest.durationS) }}</span>
      </template>
      <span aria-hidden="true" :class="['absolute size-3 rotate-45 border-inherit bg-card', TAIL[bubble.side]]" />
    </Button>
  </div>
</template>
