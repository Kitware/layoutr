import 'materialize-css/dist/css/materialize.min.css';
import 'materialize-css/dist/js/materialize.min.js';
import 'materialize-css/extras/noUiSlider/nouislider.css';
import noUiSlider from 'materialize-css/extras/noUiSlider/nouislider.min.js';
import geo from 'geojs/geo.js';

import LayoutWorker from 'worker-loader!./worker.js';
import './index.css';

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
const map = geo.map(params.map);
const layer = map.createLayer('feature', {features: ['point', 'line']});

const uiLayer = map.createLayer('ui', {zIndex: 2});
const tooltip = uiLayer.createWidget('dom', {position: {x: 0, y: 0}});
const tooltipElem = tooltip.canvas();
tooltipElem.setAttribute('id', 'tooltip');
tooltipElem.classList.toggle('hidden', true);
tooltipElem.style['pointer-events'] = 'none';

map.draw();

let points;
let lines;
let graph;
let positions;
let nodeMap;

var layoutWorker = new LayoutWorker();
layoutWorker.onmessage = function(e) {
  if (e.data.type === 'graph') {
    graph = e.data.graph;

    nodeMap = {};
    graph.nodes.forEach((n, i) => nodeMap[n.id] = i);
    lines = layer.createFeature('line').data(graph.edges.map(e => [nodeMap[e.source], nodeMap[e.target]])).style({
      position: nodeid => graph.nodes[nodeid],
      width: 1,
      strokeColor: 'black',
      strokeOpacity: 0.01,
    });
    lines.visible(false);
    map.draw();

    points = layer.createFeature('point', {
      primitiveShape: 'triangle',
      style: {
        strokeColor: 'black',
        fillColor: 'grey',
        fillOpacity: 0.5,
        strokeOpacity: 0.5,
        radius: nodeid => Math.max(2, Math.pow(2, map.zoom()) * Math.sqrt(graph.nodes[nodeid].degree))
      },
      position: nodeid => graph.nodes[nodeid]
    }).data(Object.keys(graph.nodes));

    map.geoOn(geo.event.zoom, () => {
      points.modified().draw();
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
  if (e.data.type === 'positions') {
    positions = e.data.nodes;
    points.position(nodeid => positions[nodeid]);
    lines.position(nodeid => positions[nodeid]);
    map.draw();
  }
}

document.getElementById('toggle-start').onclick = () => {
  let mode = document.getElementById('toggle-start').innerText.toLowerCase();
  layoutWorker.postMessage({type: mode});
  document.getElementById('toggle-start').innerText = (mode === 'start' ? 'Stop': 'Start');
}

document.getElementById('save').onclick = () => {
  const nodesWithPositions = graph.nodes.map((n, i) => ({
    ...n,
    ...positions[i],
  }));
  const saveGraph = {
    nodes: nodesWithPositions,
    edges: graph.edges,
  }
  var blob = new Blob([JSON.stringify(saveGraph, null, 2)], {
    type : "data:text/json;charset=utf-8;"
  });
  const dl = document.getElementById('download');
  dl.setAttribute("href", URL.createObjectURL(blob));
  dl.setAttribute("download", "scene.json");
  dl.click();
}

document.getElementById('init-upload-edge-list').onclick = () => {
  const upload = document.getElementById('upload-edge-list');
  upload.click();
}

document.getElementById('upload-edge-list').onchange = () => {
  var file = document.getElementById('upload-edge-list').files[0];
  if (file) {
    var reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = function (evt) {
      layoutWorker.postMessage({type: 'loadEdgeList', text: evt.target.result});
    }
    reader.onerror = function (evt) {
      console.log('Error: ', evt);
    }
  }
}

let theta = document.getElementById('theta');
noUiSlider.create(theta, {
  start: 1.5,
  step: 0.1,
  range: {min: 0.5, max: 3.0},
  format: {
    to: function (value) {
      return value.toFixed(1);
    },
    from: function (value) {
      return Number(value);
    },
  }
});

theta.noUiSlider.on('update', () => {
  layoutWorker.postMessage({
    type: 'theta',
    value: theta.noUiSlider.get(),
  });
});
