<script setup lang="ts">
/**
 * One labelled slider of the alive-route-explorer block's route options, with its value beside it:
 * a dial row (icon, label, slider, value) or, `wide`, a bold label over a full-width slider. The
 * label names the row's group, the way the React lane's Slider names itself. Edit freely.
 */
import { useId, type Component } from "vue";
import { FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";

const props = defineProps<{
  label: string;
  value: number;
  /** The value as the row shows it ("1.0", "up to +3 min"). */
  shown: string;
  min: number;
  max: number;
  step: number;
  icon?: Component;
  wide?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{ change: [value: number] }>();
const id = useId();

function slide(next: number[] | undefined) {
  emit("change", next?.[0] ?? props.value);
}
</script>

<template>
  <div v-if="wide" role="group" :aria-labelledby="id" class="flex flex-col gap-2.5">
    <div class="flex items-baseline justify-between gap-3">
      <FieldLabel :id="id" class="text-base font-bold">{{ label }}</FieldLabel>
      <span class="text-sm font-semibold text-primary tabular-nums">{{ shown }}</span>
    </div>
    <Slider :aria-labelledby="id" :min="min" :max="max" :step="step" :model-value="[value]" @update:model-value="slide" />
  </div>
  <div
    v-else
    role="group"
    :aria-labelledby="id"
    :aria-disabled="disabled ? 'true' : undefined"
    :class="['grid grid-cols-[1.25rem_8.5rem_minmax(0,1fr)_2rem] items-center gap-2.5', disabled ? 'opacity-50' : '']"
  >
    <component :is="icon" v-if="icon" aria-hidden="true" class="size-4 text-muted-foreground" />
    <span v-else />
    <FieldLabel :id="id" class="text-sm font-normal">{{ label }}</FieldLabel>
    <Slider :aria-labelledby="id" :disabled="disabled" :min="min" :max="max" :step="step" :model-value="[value]" @update:model-value="slide" />
    <span class="text-right text-xs text-muted-foreground tabular-nums">{{ shown }}</span>
  </div>
</template>
