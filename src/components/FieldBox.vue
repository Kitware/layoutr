<template>
  <v-combobox
    :value="value"
    :items="items"
    :label="label"
    hide-details
    @input="update(arguments[0])"
  ></v-combobox>
</template>
<script>
export default {
  props: {
    value: null,
    items: Array,
    label: String
  },
  methods: {
    update(value) {
      this.$emit("input", value);
    }
  }
};
</script>
