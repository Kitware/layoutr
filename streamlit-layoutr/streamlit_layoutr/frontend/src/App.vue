<template>
  <div id="app">
    <WithStreamlitConnection v-slot="{ args }">
      <StreamlitLayoutr :args="args" />
    </WithStreamlitConnection>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue"
import StreamlitLayoutr from "./StreamlitLayoutr.vue"
import WithStreamlitConnection from "./streamlit/WithStreamlitConnection.vue"

export default defineComponent({
  name: "App",
  components: {
    StreamlitLayoutr,
    WithStreamlitConnection,
  },
})
</script>

<style>
body {
  margin: 0px;
}
#app {
  color: var(--text-color);
  font-family: var(--font);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
