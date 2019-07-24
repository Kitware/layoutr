<template>
  <v-combobox v-model="value" :items="items" :label="label" hide-details @change="update"></v-combobox>
</template>
<script>
export default {
  props: {
    value: null,
    items: Array,
    label: String
  },
  methods: {
    update() {
      this.$emit("input", this.value);
    }
  }
};
</script>
