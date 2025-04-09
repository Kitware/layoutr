<template>
  <div :style="{ position: 'relative', height: '1000px'}">
    <canvas ref="canvas" width="100" height="100" :style="{ width: '100%', height: '100%', position: 'absolute', left: 0, top: 0, 'z-index': 0 }"></canvas>
    <canvas ref="labelCanvas" width="100" height="100" :style="{ width: '100%', height: '100%', position: 'absolute', left: 0, top: 0, 'z-index': 1, 'pointer-events': 'none' }"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue"
import { Streamlit } from "streamlit-component-lib"
import { useStreamlit } from "./streamlit"
import { Layout } from "./lib/index"
import type { Node, SerializedGraph } from "./lib/types";

const props = defineProps<{
  args: {
    graph: string;

    run_layout: boolean;
    node_size: number;
    node_size_field: string | null;
    node_color_field: string | null;
    node_color_mode: string;
    node_opacity: number;
    node_stroke_width: number;
    node_stroke_opacity: number;
    node_label_field: string | null;
    node_label_font_size: number;
    node_label_max_count: number;
    link_width: number;
    link_opacity: number;

    energy: number;
    collide_strength: number;
    charge_strength: number;
    charge_approximation: number;
    link_strength: number;
    gravity_strength: number;
    center_strength: number;
  };
}>();

let layout: Layout | null = null;
let graph: SerializedGraph | null = null;
let hovered: Node | null = null;
let selected: Node | null = null;
const canvas = ref<HTMLCanvasElement | null>(null);
const labelCanvas = ref<HTMLCanvasElement | null>(null);

const loadGraph = () => {
  if (!layout || !props.args.graph) {
    return;
  }
  layout.loadJSON(props.args.graph);
};

onMounted(() => {
  if (!canvas.value || !labelCanvas.value) {
    return;
  }
  layout = new Layout({
    canvas: canvas.value,
    labelCanvas: labelCanvas.value,
    onHover: (hoveredNode) => {
      hovered = hoveredNode;
      Streamlit.setComponentValue({graph, hovered, selected});
    },
    onSelect: (selectedNode) => {
      selected = selectedNode;
      Streamlit.setComponentValue({graph, hovered, selected});
    },
  });
  watch(
    () => props.args.graph,
    loadGraph,
    { immediate: true },
  );

  watch(() => props.args.run_layout, () => props.args.run_layout ? layout?.start() : layout?.stop(), { immediate: true });
  watch(() => props.args.node_size, () => layout?.setNodeSize(props.args.node_size), { immediate: true });
  watch(() => props.args.node_size_field, () => layout?.setNodeSizeField(props.args.node_size_field), { immediate: true });
  watch(() => props.args.node_color_field, () => layout?.setNodeColorField(props.args.node_color_field), { immediate: true });
  watch(() => props.args.node_color_mode, () => layout?.setNodeColorMode(props.args.node_color_mode), { immediate: true });
  watch(() => props.args.node_opacity, () => layout?.setNodeOpacity(props.args.node_opacity), { immediate: true });
  watch(() => props.args.node_stroke_width, () => layout?.setNodeStrokeWidth(props.args.node_stroke_width), { immediate: true });
  watch(() => props.args.node_stroke_opacity, () => layout?.setNodeStrokeOpacity(props.args.node_stroke_opacity), { immediate: true });
  watch(() => props.args.node_label_field, () => layout?.setLabelField(props.args.node_label_field), { immediate: true });
  watch(() => props.args.node_label_font_size, () => layout?.setLabelFontSize(props.args.node_label_font_size), { immediate: true });
  watch(() => props.args.node_label_max_count, () => layout?.setLabelMaxCount(props.args.node_label_max_count), { immediate: true });
  watch(() => props.args.link_width, () => layout?.setLinkWidth(props.args.link_width), { immediate: true });
  watch(() => props.args.link_opacity, () => layout?.setLinkOpacity(props.args.link_opacity), { immediate: true });

  watch(() => props.args.energy, () => layout?.setEnergy(props.args.energy), { immediate: true });
  watch(() => props.args.collide_strength, () => layout?.setCollideStrength(props.args.collide_strength), { immediate: true });
  watch(() => props.args.charge_strength, () => layout?.setChargeStrength(props.args.charge_strength), { immediate: true });
  watch(() => props.args.charge_approximation, () => layout?.setChargeApproximation(props.args.charge_approximation), { immediate: true });
  watch(() => props.args.link_strength, () => layout?.setLinkStrength(props.args.link_strength), { immediate: true });
  watch(() => props.args.gravity_strength, () => layout?.setGravityStrength(props.args.gravity_strength), { immediate: true });
  watch(() => props.args.center_strength, () => layout?.setCenterStrength(props.args.center_strength), { immediate: true });
});

useStreamlit();

</script>
