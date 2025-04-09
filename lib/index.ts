import nodeVertexShaderSource from './shaders/node.vert?raw';
import nodeFragmentShaderSource from './shaders/node.frag?raw';
import linkVertexShaderSource from './shaders/link.vert?raw';
import linkFragmentShaderSource from './shaders/link.frag?raw';
import LayoutWorker from './worker.ts?worker';
import type { SerializedGraph, SimNode, Node } from './types';
import { generateSizeScale } from './scales';
import * as d3 from 'd3';

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

export class Layout {
  canvas: HTMLCanvasElement;
  labelCanvas: HTMLCanvasElement;
  labelCtx: CanvasRenderingContext2D;
  gl: WebGL2RenderingContext;
  graph: SerializedGraph = {
    nodes: [],
    links: [],
  };
  worker = new LayoutWorker();
  labelMaxCount = 100;
  labelField: string | null = null;
  labelFontSize = 12;
  nodeSizeField: string | null = null;
  nodeSize = 1;
  nodeColorField: string | null = null;
  nodeColorMode = 'auto';
  nodeOpacity = 0.5;
  linkWidth = 0.01;
  linkOpacity = 0.5;
  strokeWidth = 0.01;
  strokeOpacity = 0.5;

  offsets = new Float32Array();
  radii = new Float32Array();
  baseColors = new Float32Array();
  colors = new Float32Array();
  hoveredIndex = -1;
  selectedIndex = -1;
  nodeIndicesByRadius: number[] = [];

  radiusBuffer: WebGLBuffer | null = null;
  colorBuffer: WebGLBuffer | null = null;

  neighbors: number[][] = [];

  constructor({
    canvas,
    labelCanvas,
    onGraph,
    onHover,
    onSelect,
  }: {
    canvas: HTMLCanvasElement,
    labelCanvas: HTMLCanvasElement,
    onGraph?: () => void,
    onHover?: (node: Node | null) => void,
    onSelect?: (node: Node | null) => void,
  }) {
    this.canvas = canvas;
    this.gl = this.canvas.getContext('webgl2', { antialias: true })!;
    this.labelCanvas = labelCanvas;
    this.labelCtx = this.labelCanvas.getContext('2d')!;

    if (!this.gl) {
      throw new Error('Failed to get WebGL2 context');
    }
    setupWebGL(this.gl);

    let linkProgram: WebGLProgram | null = null;
    let linkMatrixLocation: WebGLUniformLocation | null = null;
    let linkWidthLocation: WebGLUniformLocation | null = null;
    let linkOpacityLocation: WebGLUniformLocation | null = null;
    let linkPositionBuffer: WebGLBuffer | null = null;
    let linkOffsetBuffer: WebGLBuffer | null = null;
    let linkColorBuffer: WebGLBuffer | null = null;

    let scale = 0.001;
    let panX = 0.0;
    let panY = 0.0;
    let mouseDown = false;
    let lastMouseX: number | null = null;
    let lastMouseY: number | null = null;

    let linkPositions = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    let linkOffsets = new Float32Array();
    let linkColors = new Float32Array();

    let positions = new Float32Array([-Math.sqrt(3), -1, Math.sqrt(3), -1, 0, 2]);
    let colors = new Float32Array();

    let program: WebGLProgram | null = null;
    let uMatrixLocation: WebGLUniformLocation | null = null;
    let uScreenWidthPixelsLocation: WebGLUniformLocation | null = null;
    let uStrokeWidthLocation: WebGLUniformLocation | null = null;
    let uStrokeOpacityLocation: WebGLUniformLocation | null = null;
    let positionBuffer: WebGLBuffer | null = null;
    let offsetBuffer: WebGLBuffer | null = null;

    let aPositionLocation: GLint = -1;
    let aOffsetLocation: GLint = -1;
    let aColorLocation: GLint = -1;
    let aRadiusLocation: GLint = -1;

    let nodeIdToIndexMap: { [id: string | number]: number } = {};

    const updateNeighbors = () => {
      const n = this.graph.nodes.length;
      const nodeMap: { [key: string]: number } = {};
      const value: number[][] = [];
      value.length = n;
      for (let i = 0; i < n; i++) {
        nodeMap[this.graph.nodes[i].id] = i;
        value[i] = [];
      }
      for (const { source, target } of this.graph.links) {
        const s = nodeMap[source];
        const t = nodeMap[target];
        value[s].push(t);
        value[t].push(s);
      }
      this.neighbors = value;
    }

    const updatePositions = (newPositions: { x: number, y: number }[]) => {
      if (this.offsets.length !== newPositions.length * 2) {
        this.offsets = new Float32Array(newPositions.length * 2);
      }
      for (let i = 0; i < newPositions.length; i++) {
        this.offsets[i * 2] = newPositions[i].x;
        this.offsets[i * 2 + 1] = newPositions[i].y;
      }
      loadOffsetBuffer(this.gl);

      const linkCount = this.graph.links.length;
      if (linkOffsets.length !== linkCount * 4) {
        linkOffsets = new Float32Array(linkCount * 4);
      }
      for (let i = 0; i < linkCount; i++) {
        const { source, target } = this.graph.links[i];
        const sourceIndex = nodeIdToIndexMap[source];
        const targetIndex = nodeIdToIndexMap[target];
        linkOffsets[i * 4] = this.offsets[sourceIndex * 2];
        linkOffsets[i * 4 + 1] = this.offsets[sourceIndex * 2 + 1];
        linkOffsets[i * 4 + 2] = this.offsets[targetIndex * 2];
        linkOffsets[i * 4 + 3] = this.offsets[targetIndex * 2 + 1];
      }
      loadlinkOffsetBuffer(this.gl);
      loadlinkColorBuffer(this.gl);
    };

    const loadlinkOffsetBuffer = (gl: WebGL2RenderingContext) => {
      if (!linkOffsetBuffer) {
        return;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, linkOffsetBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, linkOffsets, gl.DYNAMIC_DRAW);
    };

    const loadlinkColorBuffer = (gl: WebGL2RenderingContext) => {
      if (!linkColorBuffer) {
        return;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, linkColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, linkColors, gl.STATIC_DRAW);
    };


    const setupBuffersAndAttributes = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
      gl.useProgram(program);

      aPositionLocation = gl.getAttribLocation(program, 'aPosition');
      aOffsetLocation = gl.getAttribLocation(program, 'aOffset');
      aColorLocation = gl.getAttribLocation(program, 'aColor');
      aRadiusLocation = gl.getAttribLocation(program, 'aRadius');

      positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aPositionLocation);
      gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aPositionLocation, 0);

      offsetBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.offsets, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aOffsetLocation);
      gl.vertexAttribPointer(aOffsetLocation, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aOffsetLocation, 1);

      this.colorBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aColorLocation);
      gl.vertexAttribPointer(aColorLocation, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aColorLocation, 1);

      this.radiusBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.radiusBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.radii, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aRadiusLocation);
      gl.vertexAttribPointer(aRadiusLocation, 1, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aRadiusLocation, 1);
    };

    let alinkPositionLocation: GLint = -1;
    let alinkOffsetLocation: GLint = -1;

    const setuplinkBuffersAndAttributes = (gl: WebGL2RenderingContext, program: WebGLProgram) => {
      gl.useProgram(linkProgram);

      alinkPositionLocation = gl.getAttribLocation(program, 'aPosition');
      alinkOffsetLocation = gl.getAttribLocation(program, 'aOffset');

      linkPositionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, linkPositionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, linkPositions, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(alinkPositionLocation);
      gl.vertexAttribPointer(alinkPositionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(alinkPositionLocation, 0);

      linkOffsetBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, linkOffsetBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, linkOffsets, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(alinkOffsetLocation);
      gl.vertexAttribPointer(alinkOffsetLocation, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(alinkOffsetLocation, 1);
    };

    const loadOffsetBuffer = (gl: WebGL2RenderingContext) => {
      if (!offsetBuffer) {
        return;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.offsets, gl.DYNAMIC_DRAW);
    };

    const drawScene = (gl: WebGL2RenderingContext) => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const aspectRatio = gl.canvas.width / gl.canvas.height;
      const matrix = [
        scale / aspectRatio, 0, 0,
        0, scale, 0,
        panX, panY, 1
      ];

      if (linkProgram === null) {
        return;
      }

      if (this.linkWidth > 0 && this.linkOpacity > 0) {
        gl.useProgram(linkProgram);

        gl.uniformMatrix3fv(linkMatrixLocation, false, matrix);
        gl.uniform1f(linkWidthLocation, this.linkWidth);
        gl.uniform1f(linkOpacityLocation, this.linkOpacity);

        gl.bindBuffer(gl.ARRAY_BUFFER, linkPositionBuffer);
        gl.enableVertexAttribArray(alinkPositionLocation);
        gl.vertexAttribPointer(alinkPositionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(alinkPositionLocation, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, linkOffsetBuffer);
        gl.enableVertexAttribArray(alinkOffsetLocation);
        gl.vertexAttribPointer(alinkOffsetLocation, 4, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisor(alinkOffsetLocation, 1);

        gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, this.graph.links.length || 0);
      }

      if (program === null) {
        return;
      }

      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(aPositionLocation);
      gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aPositionLocation, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, offsetBuffer);
      gl.enableVertexAttribArray(aOffsetLocation);
      gl.vertexAttribPointer(aOffsetLocation, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aOffsetLocation, 1);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
      gl.enableVertexAttribArray(aColorLocation);
      gl.vertexAttribPointer(aColorLocation, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aColorLocation, 1);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.radiusBuffer);
      gl.enableVertexAttribArray(aRadiusLocation);
      gl.vertexAttribPointer(aRadiusLocation, 1, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(aRadiusLocation, 1);

      gl.uniformMatrix3fv(uMatrixLocation, false, matrix);
      gl.uniform1f(uScreenWidthPixelsLocation, gl.canvas.width);
      gl.uniform1f(uStrokeWidthLocation, this.strokeWidth);
      gl.uniform1f(uStrokeOpacityLocation, this.strokeOpacity);
      gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, positions.length / 2, this.graph.nodes.length || 0);
    };

    const drawLabels = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      if (this.labelField === null) {
        return;
      }
      ctx.font = `${this.labelFontSize}px sans-serif`;
      const n = this.graph.nodes.length;
      const aspectRatio = ctx.canvas.width / ctx.canvas.height;
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 5;
      ctx.shadowColor = 'white';
      const toDraw: { label: string, x: number, y: number }[] = [];
      for (let ind = 0; ind < n; ind++) {
        const i = this.nodeIndicesByRadius[ind];
        const cx = this.offsets[i * 2] * scale / aspectRatio + panX;
        const cy = this.offsets[i * 2 + 1] * scale + panY;
        const tx = (0.5 * cx + 0.5) * ctx.canvas.width;
        const ty = ctx.canvas.height - (0.5 * cy + 0.5) * ctx.canvas.height;
        if (tx < 0 || tx > ctx.canvas.width || ty < 0 || ty > ctx.canvas.height) {
          continue;
        }
        const name = `${this.graph.nodes[i][this.labelField]}`;
        toDraw.push({ label: name, x: tx, y: ty });
        if (this.labelMaxCount !== 0 && toDraw.length >= this.labelMaxCount) {
          break;
        }
      }

      // Reverse to draw the less important labels first
      toDraw.reverse().forEach(({ label, x, y }) => {
        // Draw multiple times to increase opacity of shadow
        ctx.fillText(label, x, y);
        ctx.fillText(label, x, y);
        ctx.fillText(label, x, y);
      });

    };

    const animate = (gl: WebGL2RenderingContext) => {
      drawScene(gl);
      drawLabels(this.labelCtx);
    };

    const handleClick = () => {
      this.selectedIndex = this.hoveredIndex;
      this.addHoverColor();
      this.addSelectColor();
      onSelect && onSelect(this.graph.nodes[this.hoveredIndex] ?? null);
    }

    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
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
      if (!canvas || !this.gl) {
        return;
      }

      const delta = Math.sign(event.deltaY) * 0.1;
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const x = (mouseX / this.gl.canvas.width) * 2 - 1;
      const y = -(mouseY / this.gl.canvas.height) * 2 + 1;

      const aspectRatio = this.gl.canvas.width / this.gl.canvas.height;
      const worldX = (x - panX) * aspectRatio / scale;
      const worldY = (y - panY) / scale;

      scale *= (1 - delta);

      panX = x - worldX * scale / aspectRatio;
      panY = y - worldY * scale;

      event.preventDefault();
    };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      labelCanvas.width = rect.width;
      labelCanvas.height = rect.height;
      this.gl.viewport(0, 0, rect.width, rect.height);
    };

    const checkHover = (mouseX: number, mouseY: number) => {
      let x = (mouseX / this.gl.canvas.width) * 2 - 1;
      let y = -(mouseY / this.gl.canvas.height) * 2 + 1;
      const aspectRatio = this.gl.canvas.width / this.gl.canvas.height;
      x = (x - panX) * aspectRatio / scale;
      y = (y - panY) / scale;
      const n = this.graph.nodes.length;
      for (let i = n - 1; i >= 0; i--) {
        const cx = this.offsets[i * 2];
        const cy = this.offsets[i * 2 + 1];
        const dist = (x - cx) ** 2 + (y - cy) ** 2;
        if (dist <= this.radii[i] ** 2) {
          return i;
        }
      }
      return -1;
    };

    const highlightHover = (mouseX: number, mouseY: number) => {
      const prevIndex = this.hoveredIndex;
      this.hoveredIndex = checkHover(mouseX, mouseY);
      if (this.hoveredIndex !== prevIndex) {
        onHover && onHover(this.graph.nodes[this.hoveredIndex] ?? null);
      }
      this.addHoverColor();
      this.addSelectColor();
    };

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      highlightHover(mouseX, mouseY);

      if (!this.gl || lastMouseX === null || lastMouseY === null) {
        return;
      }

      if (!mouseDown) {
        return;
      }

      const deltaX = (mouseX - lastMouseX) / this.gl.canvas.width * 2;
      const deltaY = -(mouseY - lastMouseY) / this.gl.canvas.height * 2;

      panX += deltaX;
      panY += deltaY;

      lastMouseX = mouseX;
      lastMouseY = mouseY;
    };

    this.worker.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'ready') {
        // workerReady = true;
      } else if (type === 'graph') {
        this.graph = event.data.graph;
        updateNeighbors();
        this.updateRadiusBuffer();
        this.updateColors();
        nodeIdToIndexMap = {};
        for (let i = 0; i < this.graph.nodes.length; i++) {
          nodeIdToIndexMap[this.graph.nodes[i].id] = i;
        }
        onGraph && onGraph();
      } else if (type === 'positions') {
        updatePositions(event.data.positions);
      }
    };

    program = createProgram(this.gl, nodeVertexShaderSource, nodeFragmentShaderSource);
    if (program === null) {
      throw new Error('Failed to create WebGL program');
    }
    this.gl.useProgram(program);

    uMatrixLocation = this.gl.getUniformLocation(program, 'uMatrix');
    uScreenWidthPixelsLocation = this.gl.getUniformLocation(program, 'uScreenWidthPixels');
    uStrokeWidthLocation = this.gl.getUniformLocation(program, 'uStrokeWidth');
    uStrokeOpacityLocation = this.gl.getUniformLocation(program, 'uStrokeOpacity');

    setupBuffersAndAttributes(this.gl, program);

    linkProgram = createProgram(this.gl, linkVertexShaderSource, linkFragmentShaderSource);
    if (linkProgram === null) {
      throw new Error('Failed to create WebGL program');
    }
    linkMatrixLocation = this.gl.getUniformLocation(linkProgram, 'uMatrix');
    linkWidthLocation = this.gl.getUniformLocation(linkProgram, 'uWidth');
    linkOpacityLocation = this.gl.getUniformLocation(linkProgram, 'uOpacity');

    setuplinkBuffersAndAttributes(this.gl, linkProgram);

    drawScene(this.gl);
    drawLabels(this.labelCtx);

    const keepAnimating = () => {
      animate(this.gl);
      requestAnimationFrame(keepAnimating);
    };
    requestAnimationFrame(keepAnimating);
    window.addEventListener('resize', handleResize);
    handleResize();

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel);
  }

  loadJSON(data: string) {
    this.worker.postMessage({ type: 'loadGraph', graph: JSON.parse(data) });
  }

  loadCSV(data: string) {
    this.worker.postMessage({ type: 'loadCSV', text: data });
  }

  start() {
    this.worker.postMessage({ type: 'start' });
  }

  stop() {
    this.worker.postMessage({ type: 'stop' });
  }

  setNodeSize(size: number) {
    this.nodeSize = size;
    this.updateRadiusBuffer();
  }

  setNodeSizeField(field: string | null) {
    this.nodeSizeField = field;
    this.updateRadiusBuffer();
  }

  setNodeOpacity(opacity: number) {
    this.nodeOpacity = opacity;
    this.updateColors();
  }

  setNodeColorField(field: string | null) {
    this.nodeColorField = field;
    this.updateColors();
  }

  setNodeColorMode(mode: string) {
    this.nodeColorMode = mode;
    this.updateColors();
  }

  setNodeStrokeWidth(width: number) {
    this.strokeWidth = width;
  }

  setNodeStrokeOpacity(opacity: number) {
    this.strokeOpacity = opacity;
  }

  setLinkWidth(width: number) {
    this.linkWidth = width;
  }

  setLinkOpacity(opacity: number) {
    this.linkOpacity = opacity;
  }

  setLabelFontSize(size: number) {
    this.labelFontSize = size;
  }

  setLabelMaxCount(max: number) {
    this.labelMaxCount = max;
  }

  setLabelField(field: string | null) {
    this.labelField = field;
  }

  setEnergy(energy: number) {
    this.worker.postMessage({ type: 'energy', value: energy });
  }

  setCollideStrength(strength: number) {
    this.worker.postMessage({ type: 'collideFactor', value: strength });
  }

  setChargeApproximation(theta: number) {
    this.worker.postMessage({ type: 'chargeApproximation', value: theta });
  }

  setChargeStrength(charge: number) {
    this.worker.postMessage({ type: 'chargeStrength', value: charge });
  }

  setLinkStrength(strength: number) {
    this.worker.postMessage({ type: 'linkFactor', value: strength });
  }

  setGravityStrength(gravity: number) {
    this.worker.postMessage({ type: 'gravity', value: gravity });
  }

  setCenterStrength(center: number) {
    this.worker.postMessage({ type: 'centerForce', value: center });
  }

  loadRadiusBuffer() {
    if (!this.radiusBuffer) {
      return;
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.radiusBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.radii, this.gl.STATIC_DRAW);
  }

  updateRadiusBuffer() {
    const n = this.graph.nodes.length;
    if (this.radii.length !== n) {
      this.radii = new Float32Array(n);
    }
    const sizeScale = generateSizeScale(this.graph.nodes, this.nodeSizeField, this.nodeSize);
    const radiusIndexPairs: { index: number; radius: number }[] = [];
    for (let i = 0; i < n; i++) {
      const radius = sizeScale(this.graph.nodes[i] as SimNode, i, this.graph.nodes as SimNode[]);
      this.radii[i] = radius;

      // Add a small random value to the radius to give a random but stable ordering
      // to labels to make sure when they are all the same size it's not always
      // the first labelMaxCount indices that are displayed.
      radiusIndexPairs.push({ index: i, radius: radius + Math.random() * 10e-8 });
    }
    this.nodeIndicesByRadius = radiusIndexPairs
      .sort((a, b) => b.radius - a.radius)
      .map(pair => pair.index);
    this.worker.postMessage({ type: 'radii', value: this.radii });
    if (this.gl) {
      this.loadRadiusBuffer();
    }
  }

  updateColors() {
    let colorScale: (value?: number | string) => string;
    if (this.nodeColorMode === 'identity') {
      colorScale = (val) => `${val}`;
    } else if (this.nodeColorField === null || this.graph.nodes.length === 0) {
      colorScale = () => 'steelblue';
    } else if (typeof this.graph.nodes[0][this.nodeColorField] === 'string') {
      const ordinal = d3.scaleOrdinal(d3.schemeCategory10);
      colorScale = (val?: number | string) => ordinal(`${val}`);
    } else {
      const maximum = this.graph.nodes.reduce((prev, cur) => Math.max(prev, +cur[this.nodeColorField!]), -Infinity);
      colorScale = (val?: number | string) => d3.interpolateBlues(0.2 + 0.8 * (+(val ?? 0) / maximum));
    }

    const n = this.graph.nodes.length;
    if (this.baseColors.length !== n * 4) {
      this.baseColors = new Float32Array(n * 4);
    }
    for (let i = 0; i < n; i++) {
      const colorValue = this.nodeColorField ? this.graph.nodes[i][this.nodeColorField] : undefined;
      const c = d3.color(colorScale(colorValue))?.rgb() || { r: 0, g: 0, b: 0 };
      this.baseColors[i * 4] = c.r / 255;
      this.baseColors[i * 4 + 1] = c.g / 255;
      this.baseColors[i * 4 + 2] = c.b / 255;
      this.baseColors[i * 4 + 3] = this.nodeOpacity;
    }
    this.addHoverColor();
    this.addSelectColor();
  }

  loadColorBuffer() {
    if (!this.colorBuffer) {
      return;
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.colors, this.gl.STATIC_DRAW);
  };

  addHoverColor() {
    if (this.colors.length !== this.baseColors.length) {
      this.colors = new Float32Array(this.baseColors.length);
    }
    this.colors.set(this.baseColors);
    const hovered = this.hoveredIndex;
    if (hovered !== -1) {
      // Make the hovered node and neighbors yellow
      this.colors[hovered * 4] = 1;
      this.colors[hovered * 4 + 1] = 1;
      this.colors[hovered * 4 + 2] = 0;
      this.colors[hovered * 4 + 3] = 1;
      const adjacent = this.neighbors[hovered];
      const n = adjacent.length;
      for (let i = 0; i < n; i++) {
        const adj = adjacent[i] * 4;
        this.colors[adj + 0] = 1;
        this.colors[adj + 1] = 1;
        this.colors[adj + 2] = 0;
        this.colors[adj + 3] = 1;
      }
    }
    this.loadColorBuffer();
  }

  addSelectColor() {
    if (this.colors.length !== this.baseColors.length) {
      this.colors = new Float32Array(this.baseColors.length);
    }
    const selected = this.selectedIndex;
    if (selected !== -1) {
      // Make the selected node red
      this.colors[selected * 4] = 1;
      this.colors[selected * 4 + 1] = 0;
      this.colors[selected * 4 + 2] = 0;
      this.colors[selected * 4 + 3] = 1;
    }
    this.loadColorBuffer();
  }
}
