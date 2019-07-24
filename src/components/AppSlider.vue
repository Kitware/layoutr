<template>
  <v-slider
    :value="value"
    :min="min"
    :max="max"
    :step="step"
    thumb-label
    :label="label"
    hide-details
    :readonly="readOnly"
    @input="update(arguments[0])"
  ></v-slider>
</template>
<script>
export default {
  props: {
    value: Number,
    label: String,
    min: {
      type: Number,
      default: 0
    },
    max: {
      type: Number,
      default: 1
    },
    step: {
      type: Number,
      default: 1
    },
    readOnly: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    update(value) {
      this.$emit("input", value);
    }
  }
};
</script>
