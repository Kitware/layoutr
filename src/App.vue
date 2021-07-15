<template>
  <v-app>
    <v-btn
      absolute
      class="ma-6"
      fab
      outlined
      small
      elevation="0"
      @click.stop="drawer = true"
    >
      <v-icon>mdi-chevron-right</v-icon>
    </v-btn>
    <v-card
      absolute
      outlined
      elevation="0"
      v-if="selected"
      id="graph-tooltip"
      width="250"
      class="pa-2"
    >
      <div v-for="field in fields" :key="field">
        <b>{{ field }}</b>: {{ selected[field] }}
      </div>
    </v-card>
    <v-navigation-drawer
      v-model="drawer"
      width="400"
      app
    >
    <v-container fluid>
      <v-row>
        <h1 class="ml-4">Layoutr</h1>
        <v-spacer/>
        <v-btn
          class="mr-4 mb-4"
          icon
          plain
          @click="drawer = false"
        >
          <v-icon>mdi-chevron-left</v-icon>
        </v-btn>
      </v-row>
      <vue-markdown v-if="markdown.visible" :source="markdown.value" />
      <v-btn
        v-if="fileUpload.visible"
        block
        elevation="0"
        color="primary"
        @click="$refs.file.click()"
      >
        Upload CSV or JSON
      </v-btn>
      <input ref="file" type="file" style="display:none" @change="upload">
      <v-row>
        <v-col>
          <v-select
            v-if="searchField.visible"
            v-model="searchField.value"
            :items="fields"
            label="Search by"
            outlined
            dense
            hide-details
          />
        </v-col>
        <v-col>
          <v-select
            v-if="searchOp.visible"
            v-model="searchOp.value"
            :items="searchOperators"
            outlined
            dense
            hide-details
          />
        </v-col>
      </v-row>
      <v-text-field
        v-if="searchOp.value !== 'is' && searchOp.value !== 'is one of'"
        v-model="searchValue.value"
        clearable
        label="Search term"
        outlined
        dense
        hide-details
      />
      <v-autocomplete
        v-if="searchOp.value === 'is'"
        v-model="searchValue.value"
        :items="searchItems"
        clearable
        label="Search term"
        outlined
        dense
        hide-details
      />
      <v-autocomplete
        v-if="searchOp.value === 'is one of'"
        v-model="searchValueList.value"
        :items="searchItems"
        multiple
        clearable
        label="Search term"
        outlined
        dense
        hide-details
        @change="updatePoints"
      />
      <v-checkbox
        v-if="showEdges.visible"
        v-model="showEdges.value"
        label="Show edges"
        class="mt-0"
        hide-details
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
      <v-select
        v-if="sizeField.visible"
        v-model="sizeField.value"
        :items="['None', ...fields]"
        label="Size"
        outlined
        dense
        hide-details
        class="mb-4"
      ></v-select>
      <v-select
        v-if="colorField.visible"
        v-model="colorField.value"
        :items="['None', ...fields]"
        label="Color"
        outlined
        dense
        hide-details
        class="mb-4"
      ></v-select>
      <v-btn
        v-if="layoutRunning.visible"
        block
        elevation="0"
        color="primary"
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
        label="Charge force"
        hide-details
      ></v-slider>
      <v-slider
        v-if="theta.visible"
        v-model="theta.value"
        :min="0.5" :max="3.0" :step="0.1"
        thumb-label
        label="Charge approx."
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
      <v-slider
        v-if="gravityStrength.visible"
        v-model="gravityStrength.value"
        :min="0.00" :max="0.1" :step="0.001"
        thumb-label
        label="Gravity"
        hide-details
      ></v-slider>
      <v-checkbox
        v-if="center.visible"
        v-model="center.value"
        label="Center"
        class="mt-0"
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
      <v-select
        v-if="xField.visible"
        v-model="xField.value"
        :items="fields"
        label="X"
        outlined
        dense
        hide-details
      ></v-select>
      <v-slider
        v-if="yStrength.visible"
        v-model="yStrength.value"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Y force"
        hide-details
      ></v-slider>
      <v-select
        v-if="yField.visible"
        v-model="yField.value"
        :items="fields"
        label="Y"
        outlined
        dense
        hide-details
      ></v-select>
      <v-slider
        v-if="radialStrength.visible"
        v-model="radialStrength.value"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label
        label="Radial force"
        hide-details
      ></v-slider>
      <v-select
        v-if="radialField.visible"
        v-model="radialField.value"
        :items="fields"
        label="Radial"
        outlined
        dense
        hide-details
        class="mb-4"
      ></v-select>
      <v-btn
        v-if="fileDownload.visible"
        elevation="0"
        color="primary"
        block
        @click="download()"
      >
        Download JSON
      </v-btn>
      <a ref="downloadAnchor" style="display:none"></a>
      <div class="mb-12">
        {{ nodeCount.toLocaleString() }} nodes, {{ edgeCount.toLocaleString() }} edges
      </div>
    </v-container>
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
import { debounce } from 'lodash';
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
      searchField: {
        visible: true,
        value: 'degree',
      },
      searchOp: {
        visible: true,
        value: 'contains',
      },
      searchValue: {
        visible: true,
        value: '',
      },
      searchValueList: {
        visible: true,
        value: [],
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
      fields: ['degree'],
      searchOperators: ['begins with', 'contains', 'is', 'is one of', 'is at least', 'is at most'],
      searchItems: [],
      nodeCount: 0,
      edgeCount: 0,
      colorScale: null,
      selected: null,
    };
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

        const opacity = (nodeid) => {
          if (this.searchValue.value || (this.searchOp.value === 'is one of' && this.searchValueList.value.length > 0)) {
            const nodeValue = `${graph.nodes[nodeid][this.searchField.value]}`.toLowerCase();
            const value = this.searchValue.value.toLowerCase();
            const valueList = this.searchValueList.value.map(d => d.toLowerCase());
            let match = true;
            switch (this.searchOp.value) {
              case 'begins with':
                match = nodeValue.startsWith(value);
                break;
              case 'contains':
                match = nodeValue.indexOf(value) >= 0;
                break;
              case 'is':
                match = nodeValue === value;
                break;
              case 'is one of':
                match = valueList.indexOf(nodeValue) >= 0;
                break;
              case 'is at least':
                match = +nodeValue >= +value;
                break;
              case 'is at most':
                match = +nodeValue <= +value;
                break;
            }
            if (!match) {
              return 0.02;
            }
          }
          return this.nodeOpacity.value;
        }

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
            fillOpacity: opacity,
            strokeOpacity: opacity,
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
            // We are only modifying the fillColor.  If we call
            // points.modified(), we invalidate the rangeTree, which is
            // unnecessary.  points._build(true) just repopulates styles (not
            // geometry).  This is probably the cheapest update that is
            // exposed by geojs.  It would be faster to call
            // updateStyleFromArray so that only the fillColor is updated,
            // but that still updates the modified time, causing the
            // rangeTree to be regenerated.  geojs would need a "mark
            // rangeTree as clean" method to work around this.
            // points.modified();
            points._build(true);
            map.draw();
          })
          .geoOn(geo.event.feature.mouseoff, function (evt) {
            this.selected = null;
            graph.nodes.forEach(n => n.select = 0);
            // points.modified();
            points._build(true);
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
    ['nodeOpacity.value']() {
      if (points) {
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
    ['colorField.value']() {
      if (points) {
        this.updateColorScale();
        points.modified();
        map.draw();
      }
    },
    ['searchField.value'](value) {
      if (graph) {
        this.searchItems = [...new Set(graph.nodes.map(d => `${d[value]}`))].sort();
      }
      if (points) {
        points.modified();
        map.draw();
      }
    },
    ['searchOp.value']() {
      if (points) {
        points.modified();
        map.draw();
      }
    },
    'searchValue.value': debounce(function () {
      if (points) {
        points.modified();
        map.draw();
      }
    }, 500),
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
    updatePoints() {
      console.log('updatePoints');
      if (points) {
        points.modified();
        map.draw();
      }
    },
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
