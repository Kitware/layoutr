<template>
  <v-app>
    <v-navigation-drawer fixed app>
      <v-btn @click="$refs.file.click()">Upload CSV or JSON</v-btn>
      <input ref="file" type="file" style="display:none" @change="upload">
      <v-checkbox
        v-model="showEdges"
        label="Show edges"
      ></v-checkbox>
      <v-slider
        v-model="edgeOpacity"
        :min="0.01" :max="1.00" :step="0.01"
        thumb-label="always"
      ></v-slider>
      <v-slider
        v-model="radius"
        :min="0.1" :max="10" :step="0.1"
        thumb-label="always"
      ></v-slider>
      <v-btn @click="toggleLayout">{{ layoutRunning ? 'Stop' : 'Start' }} layout</v-btn>
      <v-slider
        v-model="alpha"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label="always"
        :readonly="this.layoutRunning"
      ></v-slider>
      <v-checkbox
        v-model="charge"
        label="Charge force"
      ></v-checkbox>
      <v-slider
        v-model="chargeStrength"
        :min="-50" :max="50" :step="1"
        thumb-label="always"
      ></v-slider>
      <v-slider
        v-model="theta"
        :min="0.5" :max="3.0" :step="0.1"
        thumb-label="always"
      ></v-slider>
      <v-checkbox
        v-model="collide"
        label="Collide force"
      ></v-checkbox>
      <v-slider
        v-model="collideStrength"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label="always"
      ></v-slider>
      <v-checkbox
        v-model="link"
        label="Link force"
      ></v-checkbox>
      <v-slider
        v-model="linkStrength"
        :min="0.00" :max="1.00" :step="0.01"
        thumb-label="always"
      ></v-slider>
      <v-checkbox
        v-model="center"
        label="Center force"
      ></v-checkbox>
      <v-btn @click="download()">Download JSON</v-btn>
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
      showEdges: false,
      edgeOpacity: 0.5,
      radius: 2,
      layoutRunning: false,
      alpha: 1.0,
      alphaFromWorker: false,
      charge: true,
      chargeStrength: -30,
      theta: 1.5,
      collide: true,
      collideStrength: 0.7,
      link: true,
      linkStrength: 1,
      center: true,
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

    layoutWorker.onmessage = e => {
      if (e.data.type === 'graph') {
        graph = e.data.graph;

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

        points = layer.createFeature('point', {
          primitiveShape: 'triangle',
          style: {
            strokeColor: 'black',
            fillColor: 'grey',
            fillOpacity: 0.5,
            strokeOpacity: 0.5,
            radius: nodeid => Math.max(1, Math.pow(2, map.zoom()) * Math.sqrt(graph.nodes[nodeid].degree) * this.radius)
          },
          position: nodeid => graph.nodes[nodeid]
        }).data(Object.keys(graph.nodes));

        map.geoOn(geo.event.zoom, () => {
          // Ensure selection quadtree updates with new point sizes
          points.dataTime().modified();
        });

        map.draw();

        points
          .geoOn(geo.event.feature.mouseon, function (evt) {
            const nodeid = evt.data, node = graph.nodes[nodeid];
            let text = node.id;
            if (text) {
              tooltip.position(evt.mouse.geo);
              tooltipElem.innerText = text;
            }
            tooltipElem.classList.toggle('hidden', !text);
          })
          .geoOn(geo.event.feature.mousemove, function (evt) {
            tooltip.position(evt.mouse.geo);
          })
          .geoOn(geo.event.feature.mouseoff, function (evt) {
            tooltipElem.classList.toggle('hidden', true);
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

    // Add watchers which simply sync data to layout worker
    [
      'charge',
      'chargeStrength',
      'theta',
      'collide',
      'collideStrength',
      'link',
      'linkStrength',
      'center',
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
    radius: {
      handler(value) {
        layoutWorker.postMessage({type: 'radius', value});
        if (points) {
          points.modified();
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
    download() {
      const nodesWithPositions = graph.nodes.map((n, i) => ({
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
  margin-left: 0px;
  margin-top: -20px;
  height: 16px;
  line-height: 16px;
  padding: 2px 5px;
  background: rgba(255, 255, 255, 0.75);
  border-radius: 10px;
  border-bottom-left-radius: 0;
  border: 1px solid rgba(0, 0, 0, 0.75);
  font-size: 12px;
  color: black;
}
#tooltip.hidden {
  display: none;
}
</style>
