<script setup lang="ts">
import { ref, onMounted, Ref, watch } from 'vue';
import * as d3 from 'd3';
import { generateSizeScale } from './scales';
// import LayoutWorker from './worker-force.ts?worker';
// import LayoutWorker from './worker-wasm.ts?worker';
import LayoutWorker from './worker.ts?worker';
import { SerializedGraph, SimNode } from './types';
import 'remixicon/fonts/remixicon.css';

let graph : SerializedGraph = {
  nodes: [],
  links: [],
};

let neighbors: number[][] = [];

const updateNeighbors = () => {
  const n = graph.nodes.length;
  const nodeMap: {[key: string]: number} = {};
  const value: number[][] = [];
  value.length = n;
  for (let i = 0; i < n; i++) {
    nodeMap[graph.nodes[i].id] = i;
    value[i] = [];
  }
  for (const {source, target} of graph.links) {
    const s = nodeMap[source];
    const t = nodeMap[target];
    value[s].push(t);
    value[t].push(s);
  }
  neighbors = value;
}

let positions = new Float32Array([-Math.sqrt(3), -1, Math.sqrt(3), -1, 0, 2]);
let offsets = new Float32Array();
let baseColors = new Float32Array();
let colors = new Float32Array();
let radii = new Float32Array();
let colorScale: (value: number | string) => string = () => 'rgba(0,0,0,0.5)';

let program: WebGLProgram | null = null;
let uMatrixLocation: WebGLUniformLocation | null = null;
let uScreenWidthPixelsLocation: WebGLUniformLocation | null = null;
let positionBuffer: WebGLBuffer | null = null;
let offsetBuffer: WebGLBuffer | null = null;
let colorBuffer: WebGLBuffer | null = null;
let radiusBuffer: WebGLBuffer | null = null;

const worker = new LayoutWorker();

let gl: WebGL2RenderingContext | null = null;

const sendToWorker = (name: string, reference: Ref<any>) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  watch([reference], () => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      worker.postMessage({
        type: name,
        value: reference.value,
      });
    }, 500);
  }, { immediate: true });
};

const edgeWidth = ref(5.0);
const edgeOpacity = ref(0.5);
const nodeOpacity = ref(0.5);
const size = ref(0.5);
const sizeField = ref('degree');
const colorField = ref('None');
const energy = ref(1);
sendToWorker('energy', energy);
const chargeStrength = ref(30);
sendToWorker('chargeStrength', chargeStrength);
const chargeFactor = ref(1.0);
sendToWorker('chargeFactor', chargeFactor);
const chargeApproximation = ref(1.5);
sendToWorker('chargeApproximation', chargeApproximation);
const collideForce = ref(1.0);
sendToWorker('collideFactor', collideForce);
const linkForce = ref(1.0);
sendToWorker('linkFactor', linkForce);
const centerForce = ref(true);
sendToWorker('centerForce', centerForce);
// const xForce = ref(0);
// sendToWorker('xForce', xForce);
// const xField = ref('None');
// sendToWorker('xField', xField);
// const yForce = ref(0);
// sendToWorker('yForce', yForce);
// const yField = ref('None');
// sendToWorker('yField', yField);
// const radialForce = ref(0);
// sendToWorker('radialForce', radialForce);
// const radialField = ref('None');
// sendToWorker('radialField', radialField);
const gravity = ref(0);
sendToWorker('gravity', gravity);

const hoveredIndex = ref(-1);

const updateRadiusBuffer = () => {
  const n = graph.nodes.length;
  if (radii.length !== n) {
    radii = new Float32Array(n);
  }
  const sizeScale = generateSizeScale(graph.nodes, sizeField.value, size.value);
  for (let i = 0; i < n; i++) {
    radii[i] = sizeScale(graph.nodes[i] as SimNode, i, graph.nodes as SimNode[]);
  }
  worker.postMessage({ type: 'radii', value: radii });
  if (gl) {
    loadRadiusBuffer(gl);
  }
}

watch([sizeField, size], () => {
  updateRadiusBuffer();
}, { immediate: true });

const addHoverColor = () => {
  if (colors.length !== baseColors.length) {
    colors = new Float32Array(baseColors.length);
  }
  colors.set(baseColors);
  const hovered = hoveredIndex.value;
  if (hovered !== -1) {
    // Make the hovered node and neighbors yellow
    colors[hoveredIndex.value * 4] = 1;
    colors[hoveredIndex.value * 4 + 1] = 1;
    colors[hoveredIndex.value * 4 + 2] = 0;
    colors[hoveredIndex.value * 4 + 3] = 1;
    const adjacent = neighbors[hovered];
    const n = adjacent.length;
    for (let i = 0; i < n; i++) {
      const adj = adjacent[i] * 4;
      colors[adj + 0] = 1;
      colors[adj + 1] = 1;
      colors[adj + 2] = 0;
      colors[adj + 3] = 1;
    }

    // Fade all other nodes
    // const n = graph.value.nodes.length;
    // const opacity = nodeOpacity.value;
    // for (let i = 0; i < n; i++) {
    //   colors[i * 4 + 3] = (i === hovered ? (1 + opacity) / 2 : opacity / 2);
    // }
  }
  if (gl) {
    loadColorBuffer(gl);
  }
};

const updateColors = () => {
  if (colorField.value === 'None' || graph.nodes.length === 0) {
    colorScale = () => 'steelblue';
  } else if (typeof graph.nodes[0][colorField.value] === 'string') {
    const ordinal = d3.scaleOrdinal(d3.schemeCategory10);
    colorScale = (val: number | string) => ordinal(`${val}`);
  } else {
    const maximum = graph.nodes.reduce((prev, cur) => Math.max(prev, +cur[colorField.value]), -Infinity);
    colorScale = (val: number | string) => d3.interpolateBlues(0.2 + 0.8*(+val / maximum));
  }

  const n = graph.nodes.length;
  if (baseColors.length !== n * 4) {
    baseColors = new Float32Array(n * 4);
  }
  for (let i = 0; i < n; i++) {
    const c = d3.color(colorScale(graph.nodes[i][colorField.value]))?.rgb() || { r: 0, g: 0, b: 0 };
    baseColors[i * 4] = c.r / 255;
    baseColors[i * 4 + 1] = c.g / 255;
    baseColors[i * 4 + 2] = c.b / 255;
    baseColors[i * 4 + 3] = nodeOpacity.value;
  }
  addHoverColor();
};

watch([colorField, nodeOpacity], () => {
  updateColors();
}, { immediate: true });

let edgePositions = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
let edgeOffsets = new Float32Array();
let edgeColors = new Float32Array();

let nodeIdToIndexMap: {[id: string | number]: number} = {};

const updatePositions = (newPositions: {x: number, y: number}[]) => {
  if (offsets.length !== newPositions.length * 2) {
    offsets = new Float32Array(newPositions.length * 2);
  }
  for (let i = 0; i < newPositions.length; i++) {
    offsets[i * 2] = newPositions[i].x;
    offsets[i * 2 + 1] = newPositions[i].y;
  }
  if (gl) {
    loadOffsetBuffer(gl);
  }

  const edgeCount = graph.links.length;
  if (edgeOffsets.length !== edgeCount * 4) {
    edgeOffsets = new Float32Array(edgeCount * 4);
  }
  for (let i = 0; i < edgeCount; i++) {
    const { source, target } = graph.links[i];
    const sourceIndex = nodeIdToIndexMap[source];
    const targetIndex = nodeIdToIndexMap[target];
    edgeOffsets[i * 4] = offsets[sourceIndex * 2];
    edgeOffsets[i * 4 + 1] = offsets[sourceIndex * 2 + 1];
    edgeOffsets[i * 4 + 2] = offsets[targetIndex * 2];
    edgeOffsets[i * 4 + 3] = offsets[targetIndex * 2 + 1];
  }
  if (gl) {
    loadEdgeOffsetBuffer(gl);
    loadEdgeColorBuffer(gl);
  }
};

const loadEdgeOffsetBuffer = (gl: WebGL2RenderingContext) => {
  if (!edgeOffsetBuffer) {
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, edgeOffsetBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, edgeOffsets, gl.DYNAMIC_DRAW);
};

const loadEdgeColorBuffer = (gl: WebGL2RenderingContext) => {
  if (!edgeColorBuffer) {
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, edgeColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, edgeColors, gl.STATIC_DRAW);
};

let workerReady = false;

worker.onmessage = (event) => {
  const { type } = event.data;
  if (type === 'ready') {
    workerReady = true;
  } else if (type === 'graph') {
    // console.log(event.data.graph);
    graph = event.data.graph;
    updateNeighbors();
    updateRadiusBuffer();
    updateColors();
    nodeIdToIndexMap = {};
    for (let i = 0; i < graph.nodes.length; i++) {
      nodeIdToIndexMap[graph.nodes[i].id] = i;
    }
    fields.value = [
      'None',
      ...Object.keys(graph.nodes[0] || {})
        .filter((field) => !ignoredKeys.includes(field))
    ];
  } else if (type === 'positions') {
    // console.log(event.data.positions);
    updatePositions(event.data.positions);
  }
};

const canvas = ref<HTMLCanvasElement | null>(null);

const vertexShaderSource = `
  attribute vec2 aPosition;
  attribute vec2 aOffset;
  attribute vec4 aColor;
  attribute float aRadius;

  uniform mat3 uMatrix;
  uniform float uScreenWidthPixels;

  varying vec4 vColor;
  varying vec2 vPosition;
  varying float vRadius;

  void main() {
    vec2 position = aPosition * aRadius + aOffset;
    position = (uMatrix * vec3(position, 1.0)).xy;
    vPosition = aPosition;
    gl_Position = vec4(position, 0.0, 1.0);
    vColor = aColor;
    vRadius = aRadius * uMatrix[0][0] * uScreenWidthPixels / 2.0;
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying vec4 vColor;
  varying vec2 vPosition;
  varying float vRadius;

  void main() {
    float dist = length(vPosition);
    float radius = 1.0;
    float antialiasDist = 2.0 / vRadius;
    float alpha = 1.0 - smoothstep(radius - antialiasDist, radius, dist);
    if (dist > radius) {
      discard;
    }
    gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
  }
`;

const edgeVertexShaderSource = `
  attribute vec2 aPosition;
  attribute vec4 aOffset;

  uniform mat3 uMatrix;
  uniform float uWidth;

  void main() {
    vec2 dir = normalize(aOffset.zw - aOffset.xy);
    vec2 normal = vec2(-dir.y, dir.x);
    vec3 pos = vec3(
      aPosition.x * aOffset.x + (1.0 - aPosition.x) * aOffset.z + (aPosition.y - 0.5) * uWidth * normal.x,
      aPosition.x * aOffset.y + (1.0 - aPosition.x) * aOffset.w + (aPosition.y - 0.5) * uWidth * normal.y,
      1.0
    );
    vec2 position = (uMatrix * pos).xy;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const edgeFragmentShaderSource = `
  precision mediump float;

  uniform float uOpacity;

  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, uOpacity);
  }
`;

let edgeProgram: WebGLProgram | null = null;
let edgeMatrixLocation: WebGLUniformLocation | null = null;
let edgeWidthLocation: WebGLUniformLocation | null = null;
let edgeOpacityLocation: WebGLUniformLocation | null = null;
let edgePositionBuffer: WebGLBuffer | null = null;
let edgeOffsetBuffer: WebGLBuffer | null = null;
let edgeColorBuffer: WebGLBuffer | null = null;

let scale = 0.001;
let panX = 0.0;
let panY = 0.0;
let mouseDown = false;
let lastMouseX: number | null = null;
let lastMouseY: number | null = null;

const setupWebGL = (gl: WebGL2RenderingContext) => {
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
};

const createProgram = (gl: WebGL2RenderingContext, vertexShaderSource: string, fragmentShaderSource: string) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  if (!program || !vertexShader || !fragmentShader) {
    console.error('Failed to create program');
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program failed to link:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
};

const createShader = (gl: WebGL2RenderingContext, type: GLenum, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error('Failed to create shader');
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile failed with:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const setupBuffersAndAttributes = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
  const aPositionLocation = gl.getAttribLocation(program, 'aPosition');
  const aOffsetLocation = gl.getAttribLocation(program, 'aOffset');
  const aColorLocation = gl.getAttribLocation(program, 'aColor');
  const aRadiusLocation = gl.getAttribLocation(program, 'aRadius');

  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPositionLocation);
  gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);

  offsetBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aOffsetLocation);
  gl.vertexAttribPointer(aOffsetLocation, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aOffsetLocation, 1);

  colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aColorLocation);
  gl.vertexAttribPointer(aColorLocation, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aColorLocation, 1);

  radiusBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, radii, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aRadiusLocation);
  gl.vertexAttribPointer(aRadiusLocation, 1, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aRadiusLocation, 1);
};

const setupEdgeBuffersAndAttributes = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
  const aPositionLocation = gl.getAttribLocation(program, 'aPosition');
  const aOffsetLocation = gl.getAttribLocation(program, 'aOffset');

  edgePositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, edgePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, edgePositions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(aPositionLocation);
  gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);

  edgeOffsetBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, edgeOffsetBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, edgeOffsets, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aOffsetLocation);
  gl.vertexAttribPointer(aOffsetLocation, 4, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(aOffsetLocation, 1);
};

const loadOffsetBuffer = (gl: WebGL2RenderingContext) => {
  if (!offsetBuffer) {
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, offsets, gl.DYNAMIC_DRAW);
};

const loadColorBuffer = (gl: WebGL2RenderingContext) => {
  if (!colorBuffer) {
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
};

const loadRadiusBuffer = (gl: WebGL2RenderingContext) => {
  if (!radiusBuffer) {
    return;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, radii, gl.STATIC_DRAW);
};

const drawScene = (gl: WebGL2RenderingContext) => {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const aspectRatio = gl.canvas.width / gl.canvas.height;
  const matrix = [
    scale / aspectRatio, 0, 0,
    0, scale, 0,
    panX, panY, 1
  ];

  if (edgeProgram === null) {
    return;
  }

  if (edgeWidth.value > 0 && edgeOpacity.value > 0) {
    gl.useProgram(edgeProgram);
    gl.uniformMatrix3fv(edgeMatrixLocation, false, matrix);
    gl.uniform1f(edgeWidthLocation, edgeWidth.value);
    gl.uniform1f(edgeOpacityLocation, edgeOpacity.value);
    setupEdgeBuffersAndAttributes(gl, edgeProgram);
    gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, graph.links.length || 0);
    // gl.drawArraysInstanced(gl.LINES, 0, 4, graph.links.length || 0);
  }

  if (program === null) {
    return;
  }

  gl.useProgram(program);
  setupBuffersAndAttributes(gl, program);
  gl.uniformMatrix3fv(uMatrixLocation, false, matrix);
  gl.uniform1f(uScreenWidthPixelsLocation, gl.canvas.width);
  gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, positions.length / 2, graph.nodes.length || 0);
};

const animate = (gl: WebGL2RenderingContext) => {
  drawScene(gl);
};

const handleMouseDown = (event: MouseEvent) => {
  if (!canvas.value) {
    return;
  }

  const rect = canvas.value.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  mouseDown = true;
  lastMouseX = mouseX;
  lastMouseY = mouseY;
};

const handleMouseUp = () => {
  mouseDown = false;
};

const handleWheel = (event: WheelEvent) => {
  if (!canvas.value || !gl) {
    return;
  }

  const delta = Math.sign(event.deltaY) * 0.1;
  const rect = canvas.value.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  const x = (mouseX / gl.canvas.width) * 2 - 1;
  const y = -(mouseY / gl.canvas.height) * 2 + 1;

  const aspectRatio = gl.canvas.width / gl.canvas.height;
  const worldX = (x - panX) * aspectRatio / scale;
  const worldY = (y - panY) / scale;

  scale *= (1 - delta);

  panX = x - worldX * scale / aspectRatio;
  panY = y - worldY * scale;
};

const handleResize = () => {
  if (!gl || !canvas.value) {
    return;
  }
  const rect = canvas.value.getBoundingClientRect();
  canvas.value.width = rect.width;
  canvas.value.height = rect.height;
  gl.viewport(0, 0, rect.width, rect.height);
};

const checkHover = (mouseX: number, mouseY: number) => {
  if (!gl) {
    return -1;
  }
  let x = (mouseX / gl.canvas.width) * 2 - 1;
  let y = -(mouseY / gl.canvas.height) * 2 + 1;
  const aspectRatio = gl.canvas.width / gl.canvas.height;
  x = (x - panX) * aspectRatio / scale;
  y = (y - panY) / scale;
  const n = graph.nodes.length;
  for (let i = n - 1; i >= 0; i--) {
    const cx = offsets[i * 2];
    const cy = offsets[i * 2 + 1];
    const dist = (x - cx) ** 2 + (y - cy) ** 2;
    if (dist <= radii[i] ** 2) {
      return i;
    }
  }
  return -1;
};

const highlightHover = (mouseX: number, mouseY: number) => {
  hoveredIndex.value = checkHover(mouseX, mouseY);
  addHoverColor();
};

const handleMouseMove = (event: MouseEvent) => {
  if (!canvas.value) {
    return;
  }

  const rect = canvas.value.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  highlightHover(mouseX, mouseY);

  if (!gl || lastMouseX === null || lastMouseY === null) {
    return;
  }

  if (!mouseDown) {
    return;
  }

  const deltaX = (mouseX - lastMouseX) / gl.canvas.width * 2;
  const deltaY = -(mouseY - lastMouseY) / gl.canvas.height * 2;

  panX += deltaX;
  panY += deltaY;

  lastMouseX = mouseX;
  lastMouseY = mouseY;
};

onMounted(() => {
  if (!canvas.value) {
    return;
  }
  gl = canvas.value.getContext('webgl2', { antialias: true });
  if (!gl) {
    return;
  }
  setupWebGL(gl);
  program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  if (program === null) {
    return;
  }
  gl.useProgram(program);

  uMatrixLocation = gl.getUniformLocation(program, 'uMatrix');
  uScreenWidthPixelsLocation = gl.getUniformLocation(program, 'uScreenWidthPixels');

  setupBuffersAndAttributes(gl, program);

  edgeProgram = createProgram(gl, edgeVertexShaderSource, edgeFragmentShaderSource);
  if (edgeProgram === null) {
    return;
  }
  edgeMatrixLocation = gl.getUniformLocation(edgeProgram, 'uMatrix');
  edgeWidthLocation = gl.getUniformLocation(edgeProgram, 'uWidth');
  edgeOpacityLocation = gl.getUniformLocation(edgeProgram, 'uOpacity');

  setupEdgeBuffersAndAttributes(gl, edgeProgram);

  drawScene(gl);

  const keepAnimating = () => {
    if (gl) {
      animate(gl);
    }
    requestAnimationFrame(keepAnimating);
  };
  requestAnimationFrame(keepAnimating);
  window.addEventListener('resize', handleResize);
  handleResize();

  const initialGraph: any = {
    nodes: [],
    links: [],
  };

  const n = 10000;

  for (let i = 0; i < n; i++) {
    // initialGraph.nodes.push({id: i, x: 200*Math.cos(i * 2 * Math.PI / n), y: 200*Math.sin(i * 2 * Math.PI / n)});
    initialGraph.nodes.push({id: i});
  }

  for (let i = 0; i < n; i++) {
    initialGraph.links.push([i, (i + 1) % n]);
  }

  const waitForWorkerReady = () => {
    if (workerReady) {
      worker.postMessage({ type: 'loadGraph', graph: initialGraph });
    } else {
      setTimeout(waitForWorkerReady, 100);
    }
  };
  waitForWorkerReady();
});

const fields = ref<string[]>([]);
const ignoredKeys = ['x', 'y', 'vx', 'vy'];

const epsilon = 1e-4;

const running = ref(false);

const startOrStop = () => {
  if (running.value) {
    worker.postMessage({ type: 'stop' });
  } else {
    worker.postMessage({ type: 'start' });
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
      if (!evt.target || typeof evt.target.result !== 'string') {
        return;
      }
      const extension = file.name.split('.').slice(-1)[0];
      if (extension === 'json') {
        worker.postMessage({type: 'loadGraph', graph: JSON.parse(evt.target.result)});
      } else if (extension === 'csv') {
        worker.postMessage({type: 'loadCSV', text: evt.target.result});
      } else {
        console.log(`Error: Cannot handle files with extension ${extension}.`);
      }
    }
    reader.onerror = function (evt) {
      console.log('Error: ', evt);
    }
  }
};

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

const downloadAnchor = ref<HTMLAnchorElement | null>(null);

const download = () => {
  if (!downloadAnchor.value) {
    return;
  }
  const nodesWithPositions = graph.nodes.map(({vx, vy, index, degree, ...n}, i) => ({
    ...n,
    x: offsets[2*i],
    y: offsets[2*i+1],
  }));
  const saveGraph = {
    nodes: nodesWithPositions,
    links: graph.links.map(({source, target, weight}) => [source, target, weight]),
  }
  var blob = new Blob([JSON.stringify(saveGraph, null, 2)], {
    type : 'data:text/json;charset=utf-8;',
  });
  downloadAnchor.value.setAttribute('href', URL.createObjectURL(blob));
  downloadAnchor.value.setAttribute('download', 'graph.json');
  downloadAnchor.value.click();
};

const formatNumberWithCommas = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const showLayoutControls = ref(true);

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
    <button class="mt-4 w-full bg-gray-700 text-white border border-gray-600 rounded py-1 hover:bg-gray-600" @click="$refs.fileElement.click()">
      Upload
    </button>
    <input ref="fileElement" type="file" class="hidden" @change="upload">
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Edge Width</label>
      <input type="range" v-model.number="edgeWidth" :min="0" :max="50" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Edge Opacity</label>
      <input type="range" v-model.number="edgeOpacity" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
    </div>
    <div class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Node Opacity</label>
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
        <label class="block text-sm font-medium text-gray-300">Charge Force</label>
        <input type="range" v-model.number="chargeFactor" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
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
      <!-- <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">X Force</label>
        <input type="range" v-model="xForce" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">X Field</label>
        <select v-model="xField" class="text-sm w-full mt-1 mb-1 bg-gray-700 text-white border border-gray-600 rounded">
          <option v-for="field in fields" :key="field" :value="field">{{ field }}</option>
        </select>
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Y Force</label>
        <input type="range" v-model="yForce" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Y Field</label>
        <select v-model="yField" class="text-sm w-full mt-1 mb-1 bg-gray-700 text-white border border-gray-600 rounded">
          <option v-for="field in fields" :key="field" :value="field">{{ field }}</option>
        </select>
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Radial Force</label>
        <input type="range" v-model="radialForce" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Radial Field</label>
        <select v-model="radialField" class="text-sm w-full mt-1 mb-1 bg-gray-700 text-white border border-gray-600 rounded">
          <option v-for="field in fields" :key="field" :value="field">{{ field }}</option>
        </select>
      </div> -->
      <div class="mt-2">
        <label class="block text-sm font-medium text-gray-300">Gravity</label>
        <input type="range" v-model="gravity" :min="0" :max="1" :step="epsilon" class="w-full mt-1">
      </div>
      <div class="mt-2">
        <button class="w-full bg-gray-700 text-white border border-gray-600 rounded py-1 hover:bg-gray-600" @click="download()">
          Download With Positions
        </button>
      </div>
      <a ref="downloadAnchor" class="hidden"></a>
    </div>
    <div class="mt-2">
      {{ formatNumberWithCommas(graph.nodes.length) }} nodes <span class="ml-2"></span> {{ formatNumberWithCommas(graph.links.length) }} links
    </div>
    <div v-if="hoveredIndex !== -1" class="mt-2">
      <label class="block text-sm font-medium text-gray-300">Hovered Node</label>
      <div class="text-sm mt-1">
        <div v-for="key in Object.keys(graph.nodes[hoveredIndex] || {}).filter((key) => !ignoredKeys.includes(key))" :key="key">
          {{ key }}: {{ graph.nodes[hoveredIndex][key] }}
        </div>
      </div>
    </div>

  </aside>
  <main class="flex-1 bg-gray-100">
    <canvas
      ref="canvas"
      class="w-full h-full"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mousemove="handleMouseMove"
      @wheel="handleWheel"
      @mousedown.prevent
      @mousemove.prevent
    ></canvas>
  </main>
</div>
</template>
