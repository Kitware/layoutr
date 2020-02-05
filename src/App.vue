<template>
  <v-app>
    <v-btn
      absolute
      class="ma-6"
      fab
      @click.stop="drawer = true"
    >
      <v-icon>mdi-menu</v-icon>
    </v-btn>
    <v-card
      absolute
      elevation="4"
      v-if="selected"
      id="graph-tooltip"
      width="250"
      class="pa-2"
    >
      <div v-for="field in fields" :key="field">
        {{ field }}: {{ selected[field] }}
      </div>
    </v-card>
    <v-navigation-drawer
      v-model="drawer"
      width="400"
      class="pa-4"
      app
      temporary
    >
      <v-row>
        <v-spacer/>
        <v-btn class="mr-4 mb-4" @click="drawer = false">
          Go to network <v-icon right>mdi-arrow-right</v-icon>
        </v-btn>
      </v-row>
      <vue-markdown v-if="markdown.visible" :source="markdown.value" />
      <v-btn v-if="fileUpload.visible" block @click="$refs.file.click()">Upload CSV or JSON</v-btn>
      <input ref="file" type="file" style="display:none" @change="upload">
      <v-checkbox
        v-if="showEdges.visible"
        v-model="showEdges.value"
        label="Show edges"
      />
      <v-slider
        v-if="edgeOpacity.visible"
        v-model="edgeOpacity.value"
        :min="0.01" :max="1.00" :step="0.01"
        thumb-label
        label="Edge opacity"
        hide-details
      ></v-slider>
      <v-slider
        v-if="nodeOpacity.visible"
        v-model="nodeOpacity.value"
        :min="0.01" :max="1.00" :step="0.01"
        thumb-label
        label="Node opacity"
        hide-details
      ></v-slider>
      <v-slider
        v-if="nodeStrokeWidth.visible"
        v-model="nodeStrokeWidth.value"
        :min="0" :max="1.00" :step="0.01"
        thumb-label
        label="Node stroke width"
        hide-details
      ></v-slider>
      <v-slider
        v-if="size.visible"
        v-model="size.value"
        :min="0.01" :max="1" :step="0.01"
        thumb-label
        label="Size"
        hide-details
      ></v-slider>
      <v-combobox
        v-if="sizeField.visible"
        v-model="sizeField.value"
        :items="['None', ...fields]"
        label="Size field"
        hide-details
      ></v-combobox>
      <v-combobox
        v-if="colorField.visible"
        v-model="colorField.value"
        :items="['None', ...fields]"
        label="Color field"
        hide-details
        class="mb-4"
      ></v-combobox>
      <v-btn
        v-if="layoutRunning.visible"
        block
        @click="toggleLayout"
      >
        {{ layoutRunning.value ? 'Stop' : 'Start' }} layout
      </v-btn>
      <v-slider
        v-if="alpha.visible"
        v-model="alpha.value"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Energy"
        hide-details
      ></v-slider>
      <v-slider
        v-if="chargeStrength.visible"
        v-model="chargeStrength.value"
        :min="0" :max="50" :step="1"
        thumb-label
        label="Charge strength"
        hide-details
      ></v-slider>
      <v-slider
        v-if="theta.visible"
        v-model="theta.value"
        :min="0.5" :max="3.0" :step="0.1"
        thumb-label
        label="Charge approximation"
        hide-details
      ></v-slider>
      <v-slider
        v-if="collideStrength.visible"
        v-model="collideStrength.value"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Collide force"
        hide-details
      ></v-slider>
      <v-slider
        v-if="linkStrength.visible"
        v-model="linkStrength.value"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Link force"
        hide-details
      ></v-slider>
      <v-checkbox
        v-if="center.visible"
        v-model="center.value"
        label="Center force"
        hide-details
      ></v-checkbox>
      <v-slider
        v-if="xStrength.visible"
        v-model="xStrength.value"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="X force"
        hide-details
      ></v-slider>
      <v-combobox
        v-if="xField.visible"
        v-model="xField.value"
        :items="fields"
        label="X field"
        hide-details
      ></v-combobox>
      <v-slider
        v-if="yStrength.visible"
        v-model="yStrength.value"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Y force"
        hide-details
      ></v-slider>
      <v-combobox
        v-if="yField.visible"
        v-model="yField.value"
        :items="fields"
        label="Y field"
        hide-details
      ></v-combobox>
      <v-slider
        v-if="radialStrength.visible"
        v-model="radialStrength.value"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Radial force"
        hide-details
      ></v-slider>
      <v-combobox
        v-if="radialField.visible"
        v-model="radialField.value"
        :items="fields"
        label="Radial field"
        hide-details
      ></v-combobox>
      <v-slider
        v-if="gravityStrength.visible"
        v-model="gravityStrength.value"
        :min="0.00" :max="0.1" :step="0.001"
        thumb-label
        label="Gravity"
        hide-details
      ></v-slider>
      <v-btn v-if="fileDownload.visible" block @click="download()">Download JSON</v-btn>
      <a ref="downloadAnchor" style="display:none"></a>
      <div class="mb-12">
        {{ nodeCount.toLocaleString() }} nodes, {{ edgeCount.toLocaleString() }} edges
      </div>
    </v-navigation-drawer>
    <v-content>
      <div id="map"></div>
    </v-content>
  </v-app>
</template>

<script>
import geo from 'geojs/geo.js';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10, interpolateBlues } from 'd3-scale-chromatic';
import { extent } from 'd3';
import VueMarkdown from 'vue-markdown';

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
  components: {
    VueMarkdown,
  },
  data: function () {
    return {
      drawer: true,
      markdown: {
        visible: true,
        value: '',
      },
      fileUpload: {
        visible: true,
      },
      showEdges: {
        visible: true,
        value: false,
      },
      edgeOpacity: {
        visible: true,
        value: 0.01,
      },
      nodeOpacity: {
        visible: true,
        value: 0.5,
      },
      nodeStrokeWidth: {
        visible: true,
        value: 1.0,
      },
      size: {
        visible: true,
        value: 0.5,
      },
      sizeField: {
        visible: true,
        value: 'degree',
      },
      colorField: {
        visible: true,
        value: 'None',
      },
      layoutRunning: {
        visible: true,
        value: false,
      },
      alpha: {
        visible: true,
        value: 1.0,
      },
      chargeStrength: {
        visible: true,
        value: 30,
      },
      theta: {
        visible: true,
        value: 1.5,
      },
      collideStrength: {
        visible: true,
        value: 0.7,
      },
      linkStrength: {
        visible: true,
        value: 1.0,
      },
      center: {
        visible: true,
        value: true,
      },
      xField: {
        visible: true,
        value: null,
      },
      xStrength: {
        visible: true,
        value: 0.0,
      },
      yField: {
        visible: true,
        value: null,
      },
      yStrength: {
        visible: true,
        value: 0.0,
      },
      radialField: {
        visible: true,
        value: null,
      },
      radialStrength: {
        visible: true,
        value: 0.0,
      },
      gravityStrength: {
        visible: true,
        value: 0.0,
      },
      fileDownload: {
        visible: true,
      },
      fields: [],
      nodeCount: 0,
      edgeCount: 0,
      colorScale: null,
      selected: null,
      graphSettings: [
        'markdown',
        'showEdges',
        'edgeOpacity',
        'nodeOpacity',
        'nodeStrokeWidth',
        'size',
        'sizeField',
        'colorField',
        'layoutRunning',
        'alpha',
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
        'gravityStrength',
      ],
    };
  },

  created() {
    this.updateValuesBastedOnURLParams();
    this.addUpdateURLWatchers();
  },

  mounted() {
    let b = 32000;
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

    map.draw();

    // Load the graph if we have one as a URL parameter
    const url = new URL(window.location.href);
    const configURL = url.searchParams.get('config');
    if (configURL) {
      fetch(configURL)
        .then(response => {
          response.text().then(text => {
            const config = JSON.parse(text);
            Object.keys(config).forEach(key => {
              this[key] = {
                ...this[key],
                ...config[key],
              };
            });
          });
        });
    }
    const graphURL = url.searchParams.get('graph');
    if (graphURL) {
      fetch(graphURL)
        .then(response => Promise.all([response.text(), response.headers.get('Content-Type')]))
        .then(([content, contentType]) => {
          if (contentType.startsWith('application/json')) {
            layoutWorker.postMessage({type: 'loadJSON', text: JSON.parse(content)});
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

        const ignoreFields = ['x', 'y', 'vx', 'vy', 'select'];
        const xRange = extent(graph.nodes, (d) => d.x);
        const yRange = extent(graph.nodes, (d) => d.y);
        const {zoom, center} = map.zoomAndCenterFromBounds({
          left: xRange[0],
          right: xRange[1],
          top: yRange[0],
          bottom: yRange[1],
        });
        map.zoom(zoom);
        map.center(center);
        window.map = map;

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
          strokeColor: 'black',
          strokeOpacity: this.edgeOpacity.value,
        });
        lines.visible(this.showEdges.value);
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

        // TODO: call geoUtils.convertColor
        // TODO: look into https://opengeoscience.github.io/geojs/examples/animation/
        // pointFeature.updateStyleFromArray(updateStyles, null, true);
        this.updateColorScale();

        points = layer.createFeature('point', {
          primitiveShape: 'triangle',
          style: {
            strokeColor: 'black',
            fillColor: nodeid => {
              if (graph.nodes[nodeid].select) {
                return ['yellow', 'red'][graph.nodes[nodeid].select - 1];
              }
              if (this.colorField.value === 'None') {
                return 'grey';
              }
              return this.colorScale(graph.nodes[nodeid][this.colorField.value]);
            },
            fillOpacity: this.nodeOpacity.value,
            strokeOpacity: this.nodeOpacity.value,
            strokeWidth: this.nodeStrokeWidth.value,
          },
          position: nodeid => graph.nodes[nodeid]
        }).data(Object.keys(graph.nodes));

        this.updateSizeScale();
        this.updateColorScale();

        map.geoOn(geo.event.zoom, () => {
          // Ensure selection quadtree updates with new point sizes
          points.dataTime().modified();
        });

        map.draw();

        points
          .geoOn(geo.event.feature.mouseon, (evt) => {
            const nodeid = evt.data;
            const node = graph.nodes[nodeid];
            this.selected = {id: node.id};
            this.fields.forEach((field) => this.selected[field] = node[field]);
            node.adj.forEach(n => n.select = 1);
            node.select = 2;
            points.modified();
            map.draw();
          })
          .geoOn(geo.event.feature.mouseoff, function (evt) {
            this.selected = null;
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
      'gravityStrength',
    ].forEach(name => {
      function sendToWorker(value) {
        layoutWorker.postMessage({type: name, value});
      }
      this.$watch(`${name}.value`, {
        handler: sendToWorker,
        immediate: true,
      });
    });
  },
  watch: {
    ['showEdges.value'](value) {
      if (lines) {
        lines.visible(value);
        if (value) {
          lines.position(nodeid => positions[nodeid]);
        }
        map.draw();
      }
    },
    ['edgeOpacity.value'](value) {
      if (lines) {
        lines.style('strokeOpacity', value);
        lines.modified();
        map.draw();
      }
    },
    ['nodeOpacity.value'](value) {
      if (points) {
        points.style('strokeOpacity', value);
        points.style('fillOpacity', value);
        points.modified();
        map.draw();
      }
    },
    ['nodeStrokeWidth.value'](value) {
      if (points) {
        points.style('strokeWidth', value);
        points.modified();
        map.draw();
      }
    },
    ['alpha.value']: {
      handler(value) {
        layoutWorker.postMessage({type: 'alpha', value: value});
      },
      immediate: true,
    },
    ['size.value']: {
      handler(value) {
        layoutWorker.postMessage({type: 'size', value});
        if (points) {
          this.updateSizeScale();
          map.draw();
        }
      },
      immediate: true,
    },
    ['sizeField.value']: {
      handler(value) {
        layoutWorker.postMessage({type: 'sizeField', value});
        if (points) {
          this.updateSizeScale();
          map.draw();
        }
      },
      immediate: true,
    },
    ['colorField.value'](value) {
      if (points) {
        this.updateColorScale();
        points.modified();
        map.draw();
      }
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
            layoutWorker.postMessage({type: 'loadJSON', text: JSON.parse(evt.target.result)});
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
      this.layoutRunning.value = !this.layoutRunning.value;
      layoutWorker.postMessage({type: 'layout', value: this.layoutRunning.value});
      if (this.layoutRunning.value) {
        // Don't draw edges while performing layout for performance reasons
        lines.visible(false);
      } else {
        // Reenable edge drawing
        if (this.showEdges.value) {
          lines.visible(true);
          lines.position(nodeid => positions[nodeid]);
          map.draw();
        }
      }
    },
    updateSizeScale() {
      if (points) {
        const sizeScale = scales.generateSizeScale(graph.nodes, this.sizeField.value, this.size.value);
        points.style('radius', (nodeid) => {
          return Math.pow(2, map.zoom()) * sizeScale(graph.nodes[nodeid]);
        });
      }
    },
    updateColorScale() {
      if (!points || typeof graph.nodes[0][this.colorField.value] === 'string') {
        this.colorScale = scaleOrdinal(schemeCategory10);
      } else {
        const maximum = graph.nodes.reduce((prev, cur) => Math.max(prev, cur[this.colorField.value]), -Infinity);
        this.colorScale = (val) => interpolateBlues(0.2 + 0.8*(val / maximum));
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

    addUpdateURLWatchers() {
      this.graphSettings.forEach((option) => {
        this.$watch(`${option}.value`, () => this.updateURLParams());
      });
    },

    updateURLParams() {
      const url = [];
      this.graphSettings.forEach((option) => {
        url.push(`${option}=${encodeURI(this[option].value)}`)
      });

      const urlParams = this.getURLParams();
      
      if (urlParams.config) {
        url.push(`config=${urlParams.config}`);
      }

      if (urlParams.graph) {
        url.push(`graph=${urlParams.graph}`);
      }

      window.history.replaceState(null, null, `?${url.join('&')}`);
    },

    updateValuesBastedOnURLParams() {
      const urlParams = this.getURLParams();

      this.graphSettings.forEach((option) => {
        const tempValue = urlParams[option] || this[option].value;
        if (typeof this[option].value === 'number') {
          this[option].value = +decodeURI(tempValue);
        } else {
          this[option].value = decodeURI(tempValue);
          if (this[option].value === 'false') {
            this[option].value = false;
          } else if (this[option].value === 'true') {
            this[option].value = true;
          }
        }
      });
    },

    getURLParams() {
      const urlParams = {};
      window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        urlParams[key] = value;
      });
      return urlParams;
    }
  },
}
</script>

<style scoped>
#map {
  height: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
}
#graph-tooltip {
  position: absolute;
  z-index: 5;
  right: 10px;
  top: 10px;
}
</style>
