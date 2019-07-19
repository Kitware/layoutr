<template>
  <v-app>
    <v-navigation-drawer fixed app class="pa-4">
      <v-btn block @click="$refs.file.click()">Upload CSV or JSON</v-btn>
      <input ref="file" type="file" style="display:none" @change="upload">
      <div>{{ nodeCount }} nodes, {{ edgeCount }} edges</div>
      <v-checkbox
        v-model="showEdges"
        label="Show edges"
        hide-details
      ></v-checkbox>
      <v-slider
        v-model="edgeOpacity"
        :min="0.01" :max="1.00" :step="0.01"
        thumb-label
        label="Edge opacity"
        hide-details
      ></v-slider>
      <v-slider
        v-model="size"
        :min="0.01" :max="1" :step="0.01"
        thumb-label
        label="Size"
        hide-details
      ></v-slider>
      <v-combobox
        v-model="sizeField"
        :items="fields"
        label="Size field"
        hide-details
      ></v-combobox>
      <v-btn block @click="toggleLayout">{{ layoutRunning ? 'Stop' : 'Start' }} layout</v-btn>
      <v-slider
        v-model="alpha"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        :readonly="this.layoutRunning"
        label="Energy"
        hide-details
      ></v-slider>
      <v-slider
        v-model="chargeStrength"
        :min="0" :max="50" :step="1"
        thumb-label
        label="Charge strength"
        hide-details
      ></v-slider>
      <v-slider
        v-model="theta"
        :min="0.5" :max="3.0" :step="0.1"
        thumb-label
        label="Charge approximation"
        hide-details
      ></v-slider>
      <v-slider
        v-model="collideStrength"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Collide force"
        hide-details
      ></v-slider>
      <v-slider
        v-model="linkStrength"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Link force"
        hide-details
      ></v-slider>
      <v-checkbox
        v-model="center"
        label="Center force"
        hide-details
      ></v-checkbox>
      <v-slider
        v-model="xStrength"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="X force"
        hide-details
      ></v-slider>
      <v-combobox
        v-model="xField"
        :items="fields"
        label="X field"
        hide-details
      ></v-combobox>
      <v-slider
        v-model="yStrength"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Y force"
        hide-details
      ></v-slider>
      <v-combobox
        v-model="yField"
        :items="fields"
        label="Y field"
        hide-details
      ></v-combobox>
      <v-slider
        v-model="radialStrength"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Radial force"
        hide-details
      ></v-slider>
      <v-combobox
        v-model="radialField"
        :items="fields"
        label="Radial field"
        hide-details
      ></v-combobox>
      <v-btn block @click="download()">Download JSON</v-btn>
      <a ref="downloadAnchor" style="display:none"></a>
    </v-navigation-drawer>
    <v-content>
      <div id="map"></div>
    </v-content>
  </v-app>
</template>

<script>
import geo from 'geojs/geo.js';

import LayoutWorker from 'worker-loader!./worker.js';
import * as scales from './scales.js';

const layoutWorker = new LayoutWorker();
let map;
let lines;
let points;
let graph;
let positions;
let nodeMap;

export default {
  data: function () {
    return {
      fields: [],
      showEdges: false,
      edgeOpacity: 0.5,
      size: 0.5,
      sizeField: 'degree',
      layoutRunning: false,
      alpha: 1.0,
      alphaFromWorker: false,
      chargeStrength: 30,
      theta: 1.5,
      collideStrength: 0.7,
      linkStrength: 1,
      center: true,
      xField: null,
      xStrength: 0,
      yField: null,
      yStrength: 0,
      radialField: null,
      radialStrength: 0,
      nodeCount: 0,
      edgeCount: 0,
    };
  },
  mounted() {
    let b = 20000;
    let bounds = {
      minx: -b,
      maxx: b,
      miny: -b,
      maxy: b,
    };
    let params = geo.util.pixelCoordinateParams(
      '#map', bounds.maxx - bounds.minx, bounds.maxy - bounds.miny);

    // the utility function assumes top left is 0, 0.  Move it to minx, miny.
    params.map.maxBounds.left += bounds.minx;
    params.map.maxBounds.top += bounds.miny;
    params.map.maxBounds.right += bounds.minx;
    params.map.maxBounds.bottom += bounds.miny;
    params.map.center.x += bounds.minx;
    params.map.center.y += bounds.miny;

    // inflate the bounds to add a border
    const maxwh = Math.max(bounds.maxx - bounds.minx, bounds.maxy - bounds.miny);
    params.map.maxBounds.left -= maxwh * 0.1;
    params.map.maxBounds.top -= maxwh * 0.1;
    params.map.maxBounds.right += maxwh * 0.1;
    params.map.maxBounds.bottom += maxwh * 0.1;

    // allow zoomming in until 1 unit of space is 2^(value) bigger.
    params.map.max += 3;
    map = geo.map(params.map);
    let layer = map.createLayer('feature', {features: ['point', 'line']});

    const uiLayer = map.createLayer('ui', {zIndex: 2});
    const tooltip = uiLayer.createWidget('dom', {position: {x: 0, y: 0}});
    const tooltipElem = tooltip.canvas();
    tooltipElem.setAttribute('id', 'tooltip');
    tooltipElem.classList.toggle('hidden', true);
    tooltipElem.style['pointer-events'] = 'none';

    map.draw();

    // Load the graph if we have one as a URL parameter
    const url = new URL(window.location.href);
    const graphURL = url.searchParams.get('graph');
    if (graphURL) {
      fetch(graphURL)
        .then(response => Promise.all([response.text(), response.headers.get('Content-Type')]))
        .then(([content, contentType]) => {
          if (contentType.startsWith('application/json')) {
            layoutWorker.postMessage({type: 'loadJSON', text: content});
          } else if (contentType.startsWith('text/csv')) {
            layoutWorker.postMessage({type: 'loadEdgeList', text: content});
          } else {
            console.log(`Error: Cannot handle files with content type ${contentType}.`);
          }
        });
    }

    layoutWorker.onmessage = e => {
      if (e.data.type === 'graph') {
        graph = e.data.graph;
        this.nodeCount = graph.nodes.length;
        this.edgeCount = graph.edges.length;

        const ignoreFields = ['x', 'y', 'vx', 'vy'];
        this.fields = [];
        graph.nodes.forEach(n => {
          Object.keys(n).forEach(f => {
            if (!ignoreFields.includes(f) && !this.fields.includes(f)) {
              this.fields.push(f);
            }
          });
        });
        this.fields.sort();

        map.deleteLayer(layer);
        layer = map.createLayer('feature', {features: ['point', 'line']});

        nodeMap = {};
        graph.nodes.forEach((n, i) => nodeMap[n.id] = i);
        lines = layer.createFeature('line').data(graph.edges.map(e => [nodeMap[e.source], nodeMap[e.target]])).style({
          position: nodeid => graph.nodes[nodeid],
          width: 1,
          strokeColor: 'black',
          strokeOpacity: this.edgeOpacity,
        });
        lines.visible(this.showEdges);
        map.draw();

        graph.nodes.forEach(n => n.adj = []);
        graph.edges.forEach(e => {
          const s = graph.nodes[nodeMap[e.source]];
          const t = graph.nodes[nodeMap[e.target]];
          if (!s.adj.includes(t)) {
            s.adj.push(t);
          }
          if (!t.adj.includes(s)) {
            t.adj.push(s);
          }
        });

        points = layer.createFeature('point', {
          primitiveShape: 'triangle',
          style: {
            strokeColor: 'black',
            fillColor: nodeid => graph.nodes[nodeid].select ? ['yellow', 'red'][graph.nodes[nodeid].select - 1] : 'grey',
            fillOpacity: 0.5,
            strokeOpacity: 0.5,
          },
          position: nodeid => graph.nodes[nodeid]
        }).data(Object.keys(graph.nodes));

        this.updateSizeScale();

        map.geoOn(geo.event.zoom, () => {
          // Ensure selection quadtree updates with new point sizes
          points.dataTime().modified();
        });

        map.draw();

        points
          .geoOn(geo.event.feature.mouseon, (evt) => {
            const nodeid = evt.data;
            const node = graph.nodes[nodeid];
            tooltip.position(evt.mouse.geo);
            let description = `<div><b>${node.id}</b></div>`;
            this.fields.forEach(key => {
              if (key !== 'id') {
                description += `<div>${key}: ${node[key]}</div>`;
              }
            })
            tooltipElem.innerHTML = description;
            tooltipElem.classList.toggle('hidden', false);
            node.adj.forEach(n => n.select = 1);
            node.select = 2;
            points.modified();
            map.draw();
          })
          .geoOn(geo.event.feature.mousemove, function (evt) {
            tooltip.position(evt.mouse.geo);
          })
          .geoOn(geo.event.feature.mouseoff, function (evt) {
            tooltipElem.classList.toggle('hidden', true);
            graph.nodes.forEach(n => n.select = 0);
            points.modified();
            map.draw();
          });
      }
      else if (e.data.type === 'positions') {
        positions = e.data.nodes;
        points.position(nodeid => positions[nodeid]);
        map.draw();
      }
      else if (e.data.type === 'alpha') {
        this.alphaFromWorker = true;
        this.alpha = e.data.value;
        this.$nextTick(() => this.alphaFromWorker = false);
      }
    }

    // Add watchers which sync data to layout worker
    [
      'chargeStrength',
      'theta',
      'collideStrength',
      'linkStrength',
      'center',
      'xField',
      'xStrength',
      'yField',
      'yStrength',
      'radialField',
      'radialStrength',
    ].forEach(name => {
      function sendToWorker(value) {
        layoutWorker.postMessage({type: name, value});
      }
      this.$watch(name, {
        handler: sendToWorker,
        immediate: true,
      });
    });
  },
  watch: {
    showEdges(value) {
      if (lines) {
        lines.visible(value);
        if (value) {
          lines.position(nodeid => positions[nodeid]);
        }
        map.draw();
      }
    },
    edgeOpacity(value) {
      if (lines) {
        lines.style('strokeOpacity', value);
        lines.modified();
        map.draw();
      }
    },
    alpha: {
      handler(value) {
        if (!this.alphaFromWorker) {
          layoutWorker.postMessage({type: 'alpha', value: value});
        }
      },
      immediate: true,
    },
    size: {
      handler(value) {
        layoutWorker.postMessage({type: 'size', value});
        if (points) {
          this.updateSizeScale();
          map.draw();
        }
      },
      immediate: true,
    },
    sizeField: {
      handler(value) {
        layoutWorker.postMessage({type: 'sizeField', value});
        if (points) {
          this.updateSizeScale();
          map.draw();
        }
      },
      immediate: true,
    },
  },
  methods: {
    upload() {
      const file = this.$refs.file.files[0];
      if (file) {
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = function (evt) {
          const extension = file.name.split('.').slice(-1)[0];
          if (extension === 'json') {
            layoutWorker.postMessage({type: 'loadJSON', text: evt.target.result});
          } else if (extension === 'csv') {
            layoutWorker.postMessage({type: 'loadEdgeList', text: evt.target.result});
          } else {
            console.log(`Error: Cannot handle files with extension ${extension}.`);
          }
        }
        reader.onerror = function (evt) {
          console.log('Error: ', evt);
        }
      }
    },
    toggleLayout() {
      this.layoutRunning = !this.layoutRunning;
      layoutWorker.postMessage({type: 'layout', value: this.layoutRunning});
      if (this.layoutRunning) {
        // Don't draw edges while performing layout for performance reasons
        lines.visible(false);
      } else {
        // Reenable edge drawing
        if (this.showEdges) {
          lines.visible(true);
          lines.position(nodeid => positions[nodeid]);
          map.draw();
        }
      }
    },
    updateSizeScale() {
      if (points) {
        const sizeScale = scales.generateSizeScale(graph.nodes, this.sizeField, this.size);
        points.style('radius', (nodeid) => {
          return Math.pow(2, map.zoom()) * sizeScale(graph.nodes[nodeid]);
        });
      }
    },
    download() {
      const nodesWithPositions = graph.nodes.map(({adj, ...n}, i) => ({
        ...n,
        ...positions[i],
      }));
      const saveGraph = {
        nodes: nodesWithPositions,
        edges: graph.edges,
      }
      var blob = new Blob([JSON.stringify(saveGraph, null, 2)], {
        type : 'data:text/json;charset=utf-8;',
      });
      this.$refs.downloadAnchor.setAttribute('href', URL.createObjectURL(blob));
      this.$refs.downloadAnchor.setAttribute('download', 'graph.json');
      this.$refs.downloadAnchor.click();
    },
  },
}
</script>

<style>
#map {
  height: 100vh;
  padding: 0;
  margin: 0;
  overflow: hidden;
}
#tooltip {
  margin-left: 20px;
  margin-top: 20px;
  line-height: 16px;
  padding: 2px 5px;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 10px;
  border-top-left-radius: 0;
  border: 1px solid rgba(0, 0, 0, 0.75);
  font-size: 12px;
  color: black;
}
#tooltip.hidden {
  display: none;
}
</style>
