<template>
  <app-slider
    v-model="value"
    :min="min"
    :max="1.00"
    :step="0.01"
    thumb-label
    :label="label"
    hide-details
    :read-only="readOnly"
    @change="update"
  ></app-slider>
</template>
<script>
import AppSlider from "./AppSlider";

export default {
  components: {
    AppSlider
  },
  props: {
    value: Number,
    label: String,
    min: {
      type: Number,
      default: 0
    },
    readOnly: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    update() {
      this.$emit("input", this.value);
    }
  }
};
</script>
