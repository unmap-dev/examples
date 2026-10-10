<script setup lang="ts" generic="T extends AcceptableValue">
import {
  ComboboxRoot,
  useForwardPropsEmits,
  type AcceptableValue,
  type ComboboxRootEmits,
  type ComboboxRootProps,
} from "reka-ui";

const props = defineProps<ComboboxRootProps<T>>();
const emits = defineEmits<ComboboxRootEmits<T>>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ComboboxRoot v-bind="forwarded" data-slot="combobox">
    <slot />
  </ComboboxRoot>
</template>
