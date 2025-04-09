<script setup lang="ts">
import { ref, onMounted, watchEffect } from 'vue';
import { Layout } from '../lib/index';
import { Node } from '../lib/types';
import 'remixicon/fonts/remixicon.css';

let layout: Layout | null = null;

const canvas = ref<HTMLCanvasElement | null>(null);
const labelCanvas = ref<HTMLCanvasElement | null>(null);

onMounted(() => {
  if (!canvas.value || !labelCanvas.value) {
    return;
  }
  layout = new Layout({
    canvas: canvas.value,
    labelCanvas: labelCanvas.value,
    onGraph: () => {
      if (!layout) {
        return;
      }
      fields.value = [
        'None',
        ...Object.keys(layout.graph.nodes[0] || {})
          .filter((field) => !ignoredKeys.includes(field))
      ];
    },
    onHover: (node) => {
      hoveredNode.value = node;
    },
  });

  watchEffect(() => layout?.setLabelField(labelField.value === 'None' ? null : labelField.value));
  watchEffect(() => layout?.setLabelFontSize(labelFontSize.value));
  watchEffect(() => layout?.setLabelMaxCount(labelMaxCount.value));
  watchEffect(() => layout?.setNodeSize(size.value));
  watchEffect(() => layout?.setNodeSizeField(sizeField.value === 'None' ? null : sizeField.value));
  watchEffect(() => layout?.setNodeColorField(colorField.value === 'None' ? null : colorField.value));
  watchEffect(() => layout?.setNodeOpacity(nodeOpacity.value));
  watchEffect(() => layout?.setNodeStrokeWidth(strokeWidth.value));
  watchEffect(() => layout?.setNodeStrokeOpacity(strokeOpacity.value));
  watchEffect(() => layout?.setLinkWidth(edgeWidth.value));
  watchEffect(() => layout?.setLinkOpacity(edgeOpacity.value));

  watchEffect(() => layout?.setEnergy(energy.value));
  watchEffect(() => layout?.setCollideStrength(collideForce.value));
  watchEffect(() => layout?.setChargeStrength(chargeStrength.value));
  watchEffect(() => layout?.setChargeApproximation(chargeApproximation.value));
  watchEffect(() => layout?.setLinkStrength(linkForce.value));
  watchEffect(() => layout?.setGravityStrength(gravity.value));
  watchEffect(() => layout?.setCenterStrength(centerForce.value ? 1.0 : 0.0));
});

const fields = ref<string[]>([]);
const running = ref(false);

const startOrStop = () => {
  if (!layout) {
    return;
  }
  if (running.value) {
    layout.stop();
  } else {
    layout.start();
  }
  running.value = !running.value;
};

const fileElement = ref<HTMLInputElement | null>(null);

const upload = () => {
  if (!fileElement.value || !fileElement.value.files || fileElement.value.files.length === 0) {
    console.log('No file selected.');
    return;
  }
  const file = fileElement.value.files[0];
  if (file) {
    const reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = function (evt) {
      if (!layout || !evt.target || typeof evt.target.result !== 'string') {
        return;
      }
      const extension = file.name.split('.').slice(-1)[0];
      if (extension === 'json') {
        layout.loadJSON(evt.target.result);
      } else if (extension === 'csv') {
        layout.loadCSV(evt.target.result);
      } else {
        console.log(`Error: Cannot handle files with extension ${extension}.`);
      }
    }
    reader.onerror = function (evt) {
      console.log('Error: ', evt);
    }
  }
};

const hoveredNode = ref<Node | null>(null);

const labelFontSize = ref(12);
const labelMaxCount = ref(100);
const size = ref(0.5);
const sizeField = ref('degree');
const labelField = ref('None');
const colorField = ref('None');
const nodeOpacity = ref(0.5);
const strokeWidth = ref(1.0);
const strokeOpacity = ref(0.5);
const edgeWidth = ref(5.0);
const edgeOpacity = ref(0.5);

const energy = ref(1);
const chargeStrength = ref(30);
const chargeApproximation = ref(1.5);
const collideForce = ref(1.0);
const linkForce = ref(1.0);
const centerForce = ref(true);
const gravity = ref(0);

const showHelp = ref(false);

const exampleCSV = `source,target,weight
0,1,1
1,2,1
2,3,1`;

const exampleJSON = `{
  "nodes": [
    {"id": 0, ... },
    {"id": 1, ... },
    {"id": 2, ... }
  ],
  "links": [
    [0, 1, 1],
    [1, 2, 1],
    [2, 3, 1]
  ]
}`;

const formatNumberWithCommas = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const epsilon = 1e-4;

const showLayoutControls = ref(true);

const downloadAnchor = ref<HTMLAnchorElement | null>(null);

const download = () => {
  if (!downloadAnchor.value || !layout) {
    return;
  }
  const { graph, offsets } = layout;
  const nodesWithPositions = graph.nodes.map(({vx, vy, index, degree, ...n}, i) => ({
    ...n,
    x: offsets[2*i],
    y: offsets[2*i+1],
  }));
  const saveGraph = {
    nodes: nodesWithPositions,
    links: graph.links.map(({source, target, weight}) => [source, target, weight]),
  }
  const blob = new Blob([JSON.stringify(saveGraph, null, 2)], {
    type : 'data:text/json;charset=utf-8;',
  });
  downloadAnchor.value.setAttribute('href', URL.createObjectURL(blob));
  downloadAnchor.value.setAttribute('download', 'graph.json');
  downloadAnchor.value.click();
};

const ignoredKeys = ['x', 'y', 'vx', 'vy'];

</script>

<template>
<div class="flex h-screen">
  <aside class="w-72 bg-gray-800 text-white p-4 overflow-y-auto overflow-x-visible">
    <h1 class="text-xl mb-4 flex flex-row items-center">
      <div class="font-bold">Layoutr</div>
      <button class="ml-4 ri-information-line" :title="showHelp ? 'Hide help' : 'Show help'" @click="showHelp = !showHelp"></button>
    </h1>
    <div v-if="showHelp" class="my-2 flex flex-col">
      <p class="text-sm mt-2">
        This is a 2D embedder and visualizer which currently supports force-directed layout
        of large graphs.
        Upload a JSON or CSV file with nodes and links to get started.
      </p>
      <p class="text-sm mt-2">
        CSV format (the weight column is optional):
      </p>
      <pre class="text-xs mt-2 rounded border border-gray-600 bg-gray-700 p-1" v-text="exampleCSV"></pre>
      <p class="text-sm mt-2">
        JSON format (supports arbitrary node attributes, set x and y for initial layout, link weights are optional):
      </p>
      <pre class="text-xs mt-2 rounded border border-gray-600 bg-gray-700 p-1" v-text="exampleJSON"></pre>
      <p class="text-sm mt-2">
        After upload, start the layout and adjust the layout parameters.
      </p>
    </div>
    <button class="mt-4 w-full bg-gray-700 text-white border border-gray-600 rounded py-1 hover:bg-gray-600" @click="() => fileElement && fileElement.click()">
      Upload
    </button>
    <input ref="fileElement" type="file" class="hidden" @change="upload">
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Label Field</label>
      <select v-model="labelField" class="text-sm w-full mt-1 mb-1 bg-gray-700 text-white border border-gray-600 rounded">
        <option v-for="field in fields" :key="field" :value="field">{{ field }}</option>
      </select>
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Label Font Size</label>
      <input type="range" v-model.number="labelFontSize" :min="2" :max="24" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Max Labels</label>
      <input type="range" v-model.number="labelMaxCount" :min="0" :max="1000" :step="1" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Edge Width</label>
      <input type="range" v-model.number="edgeWidth" :min="0" :max="50" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Edge Opacity</label>
      <input type="range" v-model.number="edgeOpacity" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Stroke Width</label>
      <input type="range" v-model.number="strokeWidth" :min="0" :max="50" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Stroke Opacity</label>
      <input type="range" v-model.number="strokeOpacity" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Fill Opacity</label>
      <input type="range" v-model.number="nodeOpacity" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Size</label>
      <input type="range" v-model.number="size" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Size Field</label>
      <select v-model="sizeField" class="text-sm w-full mt-1 mb-1 bg-gray-700 text-white border border-gray-600 rounded">
        <option v-for="field in fields" :key="field" :value="field">{{ field }}</option>
      </select>
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Color Field</label>
      <select v-model="colorField" class="text-sm w-full mt-1 mb-1 bg-gray-700 text-white border border-gray-600 rounded">
        <option v-for="field in fields" :key="field" :value="field">{{ field }}</option>
      </select>
    </div>
    <div class="mt-2 text-lg text-bold" @click="showLayoutControls = !showLayoutControls">
      <div :class="showLayoutControls ? 'ri-arrow-down-s-fill' : 'ri-arrow-right-s-fill'" class="inline-block mr-2"></div>
      Layout Controls
    </div>
    <div :class="showLayoutControls ? '' : 'hidden'">
      <div class="mt-2">
        <button class="w-full bg-gray-700 text-white border border-gray-600 rounded py-1 hover:bg-gray-600" @click="startOrStop()">
          {{ running ? 'Stop' : 'Start' }} Layout
        </button>
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Energy</label>
        <input type="range" v-model.number="energy" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Charge Strength</label>
        <input type="range" v-model.number="chargeStrength" :min="0" :max="50" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Charge Approximation</label>
        <input type="range" v-model.number="chargeApproximation" :min="0.5" :max="3" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Collide Force</label>
        <input type="range" v-model.number="collideForce" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Link Force</label>
        <input type="range" v-model.number="linkForce" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <label class="flex text-sm font-medium text-gray-300 items-center mb-4">
          <input v-model="centerForce" type="checkbox" class="mr-2">
          Center Force
        </label>
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Gravity</label>
        <input type="range" v-model="gravity" :min="0" :max="0.5" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <button class="w-full bg-gray-700 text-white border border-gray-600 rounded py-1 hover:bg-gray-600" @click="download()">
          Download With Positions
        </button>
      </div>
      <a ref="downloadAnchor" class="hidden"></a>
    </div>
    <div class="mt-2">
      {{ formatNumberWithCommas(layout ? layout.graph.nodes.length : 0) }} nodes <span class="ml-2"></span> {{ formatNumberWithCommas(layout ? layout.graph.links.length : 0) }} links
    </div>
    <div v-if="hoveredNode !== null" class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Hovered Node</label>
      <div class="text-sm mt-1">
        <div v-for="key in Object.keys(hoveredNode).filter((key) => !ignoredKeys.includes(key))" :key="key">
          {{ key }}: {{ hoveredNode[key] }}
        </div>
      </div>
    </div>
  </aside>
  <main class="flex-1 bg-gray-100" @wheel.prevent>
    <div class="w-full h-full" :style="{ position: 'relative'}">
      <canvas ref="canvas" class="w-full h-full" :style="{ position: 'absolute', left: 0, top: 0, 'z-index': 0 }"></canvas>
      <canvas ref="labelCanvas" class="w-full h-full" :style="{ position: 'absolute', left: 0, top: 0, 'z-index': 1, 'pointer-events': 'none' }"></canvas>
    </div>
  </main>
</div>
</template>
