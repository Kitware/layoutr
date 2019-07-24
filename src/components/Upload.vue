<template>
  <div>
    <v-btn block @click="$refs.file.click()">Upload CSV or JSON</v-btn>
    <input ref="file" type="file" style="display:none" @change="upload" />
  </div>
</template>
<script>
export default {
  methods: {
    upload() {
      this.$emit("file", this.$refs.file.files[0]);
    }
  }
};
</script>
