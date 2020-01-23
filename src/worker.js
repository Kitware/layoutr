let d3 = require('d3/dist/d3.js');
let scales = require('./scales.js');

let size = 1;
let sizeField = 'degree';
let linkStrength = 1;
let xField = 'degree';
let yField = 'degree';
let radialField = 'degree';

let linkStrengthFunctions = {
  inverseMinDegree: link => linkStrength / Math.min(link.source.degree, link.target.degree),
  inverseSumDegree: link => linkStrength / (link.source.degree + link.target.degree),
  inverseSumSqrtDegree: link => linkStrength / (Math.sqrt(link.source.degree) + Math.sqrt(link.target.degree)),
  constant: () => linkStrength,
  radius: link => linkStrength*linkStrength / Math.min(collide.radius()(link.source), collide.radius()(link.target)),
};

let linkDistanceFunctions = {
  sumSqrtDegree: link => (Math.sqrt(link.source.degree) + Math.sqrt(link.target.degree)) * size,
  constant: () => size / 20,
  radius: link => (2 - linkStrength) * (collide.radius()(link.source) + collide.radius()(link.target)),
};

let link = d3.forceLink().id(d => d.id).distance(linkDistanceFunctions.sumSqrtDegree).strength(linkStrengthFunctions.inverseMinDegree);
let charge = d3.forceManyBody();
let collide = d3.forceCollide();
let center = d3.forceCenter();
let x = d3.forceX();
let y = d3.forceY();
let radial = d3.forceRadial();
let gravity = d3.forceRadial().radius(0);
let simulation = d3.forceSimulation()
  .alphaMin(0)
  .alphaTarget(0)
  .alphaDecay(0)
  .stop();

loadGraph = function(graph) {
  function tick() {
    postMessage({type: 'positions', nodes: graph.nodes.map(n => ({x: n.x, y: n.y}))});
  }

  if (!graph.nodes) {
    graph.nodes = d3.set([...graph.edges.map(d => d.source), ...graph.edges.map(d => d.target)]).values().map(d => ({
      id: d,
    }));
  }
  const nodeMap = {};
  graph.nodes.forEach(d => {
    d.degree = 0;
    d.id = '' + d.id;
    nodeMap[d.id] = d;
  });
  graph.edges.forEach(d => {
    d.source = '' + d.source;
    d.target = '' + d.target;
  });
  graph.edges = graph.edges.filter(e => nodeMap[e.source] && nodeMap[e.target]);
  graph.edges.forEach(d => {
    const weight = d.weight !== undefined ? +d.weight : 1
    nodeMap[d.source].degree += weight;
    nodeMap[d.target].degree += weight;
  });

  graph.nodes.sort((a, b) => d3.ascending(a.degree, b.degree));
  simulation
    .nodes(graph.nodes)
    .on('tick', tick);

  postMessage({type: 'graph', graph});
  postMessage({type: 'positions', nodes: graph.nodes.map(n => ({x: n.x, y: n.y}))});

  // Initialize data-dependent scales
  collide.radius(scales.generateSizeScale(simulation.nodes(), sizeField, size));
  x.x(scales.generateScale(simulation.nodes(), xField, {area: 1000}));
  y.y(scales.generateScale(simulation.nodes(), yField, {area: 1000}));
  radial.radius(scales.generateScale(
    simulation.nodes(), radialField, {area: 1000, min: 0.5, max: 1.5, invalid: 1.6},
  ));

  let oldLink = simulation.force('link');
  simulation.force('link', link);
  link.links(graph.edges);
  simulation.force('link', oldLink);
}

onmessage = function(e) {
  if (e.data.type === 'layout') {
    if (e.data.value) {
      simulation.restart();
    } else {
      simulation.stop();
    }
  }
  else if (e.data.type === 'loadEdgeList') {
    loadGraph({edges: d3.csvParse(e.data.text)});
  }
  else if (e.data.type === 'loadJSON') {
    loadGraph(e.data.text);
  }
  else if (e.data.type === 'theta') {
    charge.theta(e.data.value);
  }
  else if (e.data.type === 'alpha') {
    simulation.alpha(e.data.value);
  }
  else if (e.data.type === 'size') {
    size = e.data.value;
    collide.radius(scales.generateSizeScale(simulation.nodes(), sizeField, size));
    link.distance(link.distance());
    link.strength(link.strength());
  }
  else if (e.data.type === 'sizeField') {
    sizeField = e.data.value;
    collide.radius(scales.generateSizeScale(simulation.nodes(), sizeField, size));
    link.distance(link.distance());
    link.strength(link.strength());
  }
  else if (e.data.type === 'linkStrength') {
    simulation.force('link', e.data.value ? link : null);
    linkStrength = e.data.value;
    link.distance(link.distance());
    link.strength(link.strength());
  }
  else if (e.data.type === 'chargeStrength') {
    simulation.force('charge', e.data.value ? charge : null);
    charge.strength(-e.data.value);
  }
  else if (e.data.type === 'collideStrength') {
    simulation.force('collide', e.data.value ? collide : null);
    collide.strength(e.data.value);
  }
  else if (e.data.type === 'center') {
    simulation.force('center', e.data.value ? center : null);
  }
  else if (e.data.type === 'xStrength') {
    simulation.force('x', e.data.value ? x : null);
    x.strength(e.data.value);
  }
  else if (e.data.type === 'xField') {
    xField = e.data.value;
    x.x(scales.generateScale(simulation.nodes(), xField, {area: 1000}));
  }
  else if (e.data.type === 'yStrength') {
    simulation.force('y', e.data.value ? y : null);
    y.strength(e.data.value);
  }
  else if (e.data.type === 'yField') {
    yField = e.data.value;
    y.y(scales.generateScale(simulation.nodes(), yField, {min: 0.5, max: -0.5, area: 1000}));
  }
  else if (e.data.type === 'radialStrength') {
    simulation.force('radial', e.data.value ? radial : null);
    radial.strength(e.data.value);
  }
  else if (e.data.type === 'radialField') {
    radialField = e.data.value;
    radial.radius(scales.generateScale(
      simulation.nodes(), radialField, {area: 1000, min: 0.5, max: 1.5, invalid: 1.6},
    ));
  }
  else if (e.data.type === 'gravityStrength') {
    simulation.force('gravity', e.data.value ? gravity : null);
    gravity.strength(e.data.value);
  }
  else {
    throw Error(`Unknown message type '${e.data.type}'`);
  }
}
